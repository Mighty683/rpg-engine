import { sql } from "drizzle-orm";
import { databaseFromPool } from "../../database/client.ts";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { applyMigrations } from "../../migrations.ts";
import { transaction } from "../../database/transaction.ts";
import { createSession, resolveSession, revokeSession } from "./sessions.ts";
import { authenticateAccount, getAccount, registerAccount } from "./service.ts";

const url = process.env.TEST_DATABASE_URL;
const schema = `auth_test_${randomUUID().replaceAll("-", "")}`;
const admin = url ? new pg.Pool({ connectionString: url }) : null;
const pool = url
  ? new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` })
  : null;

describe.skipIf(!url)("account and session persistence", () => {
  beforeAll(async () => {
    await admin!.query(`CREATE SCHEMA ${schema}`);
    await applyMigrations(pool!);
  });

  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin?.end();
  });

  it("registers, looks up and authenticates accounts using the real database", async () => {
    const registered = await registerAccount(
      databaseFromPool(pool!),
      "DrizzleUser",
      "password-123",
    );
    expect(await getAccount(databaseFromPool(pool!), registered.id)).toEqual(registered);
    expect(
      await authenticateAccount(databaseFromPool(pool!), "drizzleuser", "wrong-password"),
    ).toEqual({ status: "invalid" });
    expect(
      await authenticateAccount(databaseFromPool(pool!), "DRIZZLEUSER", "password-123"),
    ).toEqual({ status: "ok", account: registered });
    await expect(
      registerAccount(databaseFromPool(pool!), "drizzleuser", "password-123"),
    ).rejects.toMatchObject({
      cause: { code: "23505" },
    });
  });

  it("enforces normalized usernames and resolves, expires, and revokes opaque sessions", async () => {
    const accountId = randomUUID();
    await pool!.query("INSERT INTO accounts (id, username, password_hash) VALUES ($1, $2, $3)", [
      accountId,
      "Robin",
      "test-hash",
    ]);
    await expect(
      pool!.query("INSERT INTO accounts (id, username, password_hash) VALUES ($1, $2, $3)", [
        randomUUID(),
        "robin",
        "test-hash",
      ]),
    ).rejects.toMatchObject({ code: "23505" });

    const session = await createSession(
      databaseFromPool(pool!),
      accountId,
      new Date(Date.now() + 60_000),
    );
    const saved = await pool!.query("SELECT token_digest FROM sessions WHERE id = $1", [
      session.sessionId,
    ]);
    expect(saved.rows[0].token_digest.toString()).not.toBe(session.token);
    expect(await resolveSession(databaseFromPool(pool!), session.token)).toEqual({
      sessionId: session.sessionId,
      accountId,
    });
    expect(await resolveSession(databaseFromPool(pool!), "invalid")).toBeNull();
    const expired = await createSession(
      databaseFromPool(pool!),
      accountId,
      new Date(Date.now() - 60_000),
    );
    expect(await resolveSession(databaseFromPool(pool!), expired.token)).toBeNull();
    await revokeSession(databaseFromPool(pool!), session.sessionId);
    expect(await resolveSession(databaseFromPool(pool!), session.token)).toBeNull();
  });

  it("runs post-commit callbacks only after a successful commit", async () => {
    const events: string[] = [];
    const accountId = randomUUID();
    await transaction(databaseFromPool(pool!), async (client, afterCommit) => {
      await client.execute(
        sql`INSERT INTO accounts(id, username, password_hash) VALUES (${accountId}, ${"TransactionUser"}, ${"hash"})`,
      );
      afterCommit(() => {
        events.push("committed");
      });
      expect(events).toEqual([]);
    });
    expect(events).toEqual(["committed"]);
    await expect(
      transaction(databaseFromPool(pool!), async (client, afterCommit) => {
        await client.execute(sql`DELETE FROM accounts WHERE id=${accountId}`);
        afterCommit(() => {
          events.push("rolled back");
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");
    expect(events).toEqual(["committed"]);
    expect(await getAccount(databaseFromPool(pool!), accountId)).toEqual({
      id: accountId,
      username: "TransactionUser",
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const outcome = await transaction(databaseFromPool(pool!), async (tx, afterCommit) => {
        await tx.execute(
          sql`UPDATE accounts SET username=${"TransactionUserUpdated"} WHERE id=${accountId}`,
        );
        afterCommit(() => {
          throw new Error("notification unavailable");
        });
        afterCommit(async () => {
          throw new Error("asynchronous notification unavailable");
        });
        afterCommit(() => {
          events.push("second callback");
        });
        return "committed value";
      });
      expect(outcome).toBe("committed value");
      expect(await getAccount(databaseFromPool(pool!), accountId)).toEqual({
        id: accountId,
        username: "TransactionUserUpdated",
      });
      expect(events).toContain("second callback");
      expect(log).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
    }
  });
});
