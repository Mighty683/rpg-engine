import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest();
}

/** Creates an opaque bearer token; only its digest is persisted. */
export async function createSession(pool: Pool, accountId: string, expiresAt: Date) {
  const token = randomBytes(32).toString("base64url");
  const sessionId = randomUUID();
  await pool.query(
    "INSERT INTO sessions (id, account_id, token_digest, expires_at) VALUES ($1, $2, $3, $4)",
    [sessionId, accountId, tokenDigest(token), expiresAt],
  );
  return { sessionId, token };
}

/** Resolves only unexpired sessions to their server-side identity. */
export async function resolveSession(pool: Pool, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const result = await pool.query<{ session_id: string; account_id: string }>(
    "SELECT id AS session_id, account_id FROM sessions WHERE token_digest = $1 AND expires_at > now()",
    [tokenDigest(token)],
  );
  const session = result.rows[0];
  return session ? { sessionId: session.session_id, accountId: session.account_id } : null;
}

export async function revokeSession(pool: Pool, sessionId: string) {
  await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}
