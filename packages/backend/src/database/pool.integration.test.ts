import { randomUUID } from "node:crypto";
import pg from "pg";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createRuntimePool } from "./pool.ts";
import { databaseFromPool } from "./client.ts";
import { transaction } from "./transaction.ts";

const url = process.env.TEST_DATABASE_URL;
const schema = `deadlines_${randomUUID().replaceAll("-", "")}`;
const admin = url ? new pg.Pool({ connectionString: url }) : null;
const runtimeUrl = url ? new URL(url) : null;
runtimeUrl?.searchParams.set("options", `-c search_path=${schema}`);
const timeouts = { connectionMs: 150, statementMs: 300, lockMs: 100, idleTransactionMs: 10000 };
const pool = runtimeUrl ? createRuntimePool(runtimeUrl.toString(), timeouts) : null;

describe.skipIf(!url)("runtime database deadlines", () => {
  beforeAll(async () => {
    await admin!.query(`CREATE SCHEMA "${schema}"`);
    await pool!.query("CREATE TABLE markers (id integer PRIMARY KEY, value integer NOT NULL)");
    await pool!.query("INSERT INTO markers VALUES (1, 0)");
  });
  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin?.end();
  });
  it("cancels SQL on the server, rolls back earlier writes, and suppresses after-commit events", async () => {
    const notify = vi.fn();
    const database = databaseFromPool(pool!);
    await expect(
      transaction(database, async (tx, afterCommit) => {
        await tx.execute(sql`UPDATE markers SET value=1 WHERE id=1`);
        afterCommit(notify);
        await tx.execute(sql`SELECT pg_sleep(2)`);
      }),
    ).rejects.toMatchObject({ cause: { code: "57014" } });
    expect((await pool!.query("SELECT value FROM markers WHERE id=1")).rows).toEqual([
      { value: 0 },
    ]);
    expect(notify).not.toHaveBeenCalled();
    const settings = await pool!.query(
      "SELECT current_setting('statement_timeout') AS statement, current_setting('lock_timeout') AS lock, current_setting('idle_in_transaction_session_timeout') AS idle",
    );
    expect(settings.rows[0]).toEqual({ statement: "300ms", lock: "100ms", idle: "10s" });
  });
  it("bounds lock waits and keeps the connection usable after rollback", async () => {
    const holder = await pool!.connect();
    try {
      await holder.query("BEGIN");
      await holder.query("UPDATE markers SET value=2 WHERE id=1");
      await expect(
        transaction(databaseFromPool(pool!), async (tx) => {
          await tx.execute(sql`UPDATE markers SET value=3 WHERE id=1`);
        }),
      ).rejects.toMatchObject({ cause: { code: "55P03" } });
    } finally {
      await holder.query("ROLLBACK");
      holder.release();
    }
    expect((await pool!.query("SELECT value FROM markers WHERE id=1")).rows).toEqual([
      { value: 0 },
    ]);
  });
  it("bounds pool acquisition and releases the timed-out waiter", async () => {
    const clients: pg.PoolClient[] = [];
    try {
      for (let index = 0; index < pool!.options.max!; index++) clients.push(await pool!.connect());
      await expect(pool!.connect()).rejects.toThrow(/timeout/i);
      expect(pool!.waitingCount).toBe(0);
    } finally {
      for (const client of clients) client.release();
    }
    expect((await pool!.query("SELECT 1 AS ready")).rows).toEqual([{ ready: 1 }]);
  });
});
