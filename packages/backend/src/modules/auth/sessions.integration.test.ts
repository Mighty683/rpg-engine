import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { applyMigrations } from "../../migrations.ts";
import { createSession, resolveSession, revokeSession } from "./sessions.ts";

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

    const session = await createSession(pool!, accountId, new Date(Date.now() + 60_000));
    const saved = await pool!.query("SELECT token_digest FROM sessions WHERE id = $1", [
      session.sessionId,
    ]);
    expect(saved.rows[0].token_digest.toString()).not.toBe(session.token);
    expect(await resolveSession(pool!, session.token)).toEqual({
      sessionId: session.sessionId,
      accountId,
    });
    expect(await resolveSession(pool!, "invalid")).toBeNull();
    const expired = await createSession(pool!, accountId, new Date(Date.now() - 60_000));
    expect(await resolveSession(pool!, expired.token)).toBeNull();
    await revokeSession(pool!, session.sessionId);
    expect(await resolveSession(pool!, session.token)).toBeNull();
  });
});
