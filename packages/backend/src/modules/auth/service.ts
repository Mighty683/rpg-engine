import type { GameEvents } from "../events/types.ts";
import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import type { Database } from "../../database/types.ts";
import { eq, sql } from "drizzle-orm";
import { withPasswordHashCapacity } from "./hash-capacity.ts";
import { accounts } from "../../database/schema.ts";
import { notifyAfterCommit } from "../../database/transaction.ts";

import type { revokeSession } from "./sessions.ts";

const dummyHash = argon2.hash(randomBytes(32));

export function validateCredentials(input: unknown) {
  const value =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const username = typeof value.username === "string" ? value.username.trim() : "";
  const password = typeof value.password === "string" ? value.password : "";
  const fields: Record<string, string> = {};
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username))
    fields.username = "Use 3–32 letters, numbers, dots, underscores, or hyphens.";
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 1024)
    fields.password = "Use at least 8 characters and at most 1024 bytes.";
  return { username, password, fields };
}

export async function registerAccount(database: Database, username: string, password: string) {
  const hash = await withPasswordHashCapacity(() => argon2.hash(password));
  const result = await database
    .insert(accounts)
    .values({ id: randomUUID(), username, passwordHash: hash })
    .returning({ id: accounts.id, username: accounts.username });
  return result[0]!;
}

export async function authenticateAccount(database: Database, username: string, password: string) {
  const result = await database
    .select()
    .from(accounts)
    .where(sql`lower(${accounts.username}) = lower(${username})`);
  const account = result[0];
  const hash = account?.passwordHash ?? (await dummyHash);
  const valid = await withPasswordHashCapacity(() => argon2.verify(hash, password));
  if (!account || !valid) return { status: "invalid" as const };
  return { status: "ok" as const, account: { id: account.id, username: account.username } };
}

export async function getAccount(database: Database, accountId: string) {
  const result = await database
    .select({ id: accounts.id, username: accounts.username })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  return result[0] ?? null;
}

/** Revokes the session before closing any associated live streams. */
export async function logout(events: GameEvents, revoke: (sessionId: string) => ReturnType<typeof revokeSession>, sessionId: string) {
  await revoke(sessionId);
  await notifyAfterCommit(() => events.closeSessionStreams(sessionId));
}
