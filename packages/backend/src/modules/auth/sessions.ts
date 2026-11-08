import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Database } from "../../database/types.ts";
import { sessions } from "../../database/schema.ts";

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest();
}

/** Creates an opaque bearer token; only its digest is persisted. */
export async function createSession(database: Database, accountId: string, expiresAt: Date) {
  const token = randomBytes(32).toString("base64url");
  const sessionId = randomUUID();
  await database
    .insert(sessions)
    .values({ id: sessionId, accountId, tokenDigest: tokenDigest(token), expiresAt });
  return { sessionId, token };
}

/** Resolves only unexpired sessions to their server-side identity. */
export async function resolveSession(database: Database, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const result = await database
    .select({ sessionId: sessions.id, accountId: sessions.accountId })
    .from(sessions)
    .where(and(eq(sessions.tokenDigest, tokenDigest(token)), gt(sessions.expiresAt, sql`now()`)));
  return result[0] ?? null;
}

export async function revokeSession(database: Database, sessionId: string) {
  await database.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Session persistence bound to the application's database. */
export function createSessionService(database: Database) {
  return {
    create: (accountId: string, expiresAt: Date) => createSession(database, accountId, expiresAt),
    resolve: (token: string) => resolveSession(database, token),
    revoke: (sessionId: string) => revokeSession(database, sessionId),
  };
}

