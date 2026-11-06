import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import type { Pool } from "pg";

type AccountRow = { id: string; username: string; password_hash: string };
const dummyHash = argon2.hash(randomBytes(32));

export function validateCredentials(input: unknown) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const username = typeof value.username === "string" ? value.username.trim() : "";
  const password = typeof value.password === "string" ? value.password : "";
  const fields: Record<string, string> = {};
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) fields.username = "Use 3–32 letters, numbers, dots, underscores, or hyphens.";
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 1024) fields.password = "Use at least 8 characters and at most 1024 bytes.";
  return { username, password, fields };
}

export async function registerAccount(pool: Pool, username: string, password: string) {
  const hash = await argon2.hash(password);
  const result = await pool.query<{ id: string; username: string }>(
    "INSERT INTO accounts (id, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username",
    [randomUUID(), username, hash],
  );
  return result.rows[0]!;
}

/** Limit attempts atomically per client address across backend processes. */
async function countAttempt(pool: Pool, address: string) {
  const identifier = createHash("sha256").update(address).digest();
  const result = await pool.query<{ attempts: number }>(
    `INSERT INTO sign_in_attempts (identifier_digest, attempts, window_started_at)
     VALUES ($1, 1, now())
     ON CONFLICT (identifier_digest) DO UPDATE SET
       attempts = CASE WHEN sign_in_attempts.window_started_at <= now() - interval '15 minutes' THEN 1 ELSE sign_in_attempts.attempts + 1 END,
       window_started_at = CASE WHEN sign_in_attempts.window_started_at <= now() - interval '15 minutes' THEN now() ELSE sign_in_attempts.window_started_at END
     RETURNING attempts`,
    [identifier],
  );
  return { identifier, allowed: result.rows[0]!.attempts <= 10 };
}

export async function authenticateAccount(pool: Pool, username: string, password: string, address: string) {
  const attempt = await countAttempt(pool, address);
  if (!attempt.allowed) return { status: "throttled" as const };
  const result = await pool.query<AccountRow>(
    "SELECT id, username, password_hash FROM accounts WHERE lower(username) = lower($1)",
    [username],
  );
  const account = result.rows[0];
  const valid = await argon2.verify(account?.password_hash ?? await dummyHash, password);
  if (!account || !valid) return { status: "invalid" as const };
  await pool.query("DELETE FROM sign_in_attempts WHERE identifier_digest = $1", [attempt.identifier]);
  return { status: "ok" as const, account: { id: account.id, username: account.username } };
}

export async function getAccount(pool: Pool, accountId: string) {
  const result = await pool.query<{ id: string; username: string }>(
    "SELECT id, username FROM accounts WHERE id = $1", [accountId],
  );
  return result.rows[0] ?? null;
}
