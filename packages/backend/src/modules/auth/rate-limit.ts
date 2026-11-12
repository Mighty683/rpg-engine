import { createHash } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { rateLimit, type Options, type Store } from "express-rate-limit";
import type { Database } from "../../database/types.ts";
import { signInAttempts } from "../../database/schema.ts";

/** PostgreSQL-backed counters stay independent across policies and backend processes. */
export class PostgresRateStore implements Store {
  private readonly database: Database;
  private readonly policy: string;
  private windowMs = 0;
  private nextCleanup = Date.now() + 60 * 60_000;
  constructor(database: Database, policy: string) {
    this.database = database;
    this.policy = policy;
  }
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  private key(key: string) {
    return createHash("sha256").update(`${this.policy}:${key}`).digest();
  }
  async increment(key: string) {
    if (Date.now() >= this.nextCleanup) {
      this.nextCleanup = Date.now() + 60 * 60_000;
      await this.database
        .delete(signInAttempts)
        .where(lt(signInAttempts.windowStartedAt, sql`now() - interval '1 day'`));
    }
    const expired = sql`${signInAttempts.windowStartedAt} <= now() - (${this.windowMs} * interval '1 millisecond')`;
    const [row] = await this.database
      .insert(signInAttempts)
      .values({ identifierDigest: this.key(key), attempts: 1, windowStartedAt: sql`now()` })
      .onConflictDoUpdate({
        target: signInAttempts.identifierDigest,
        set: {
          attempts: sql`CASE WHEN ${expired} THEN 1 ELSE ${signInAttempts.attempts} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${expired} THEN now() ELSE ${signInAttempts.windowStartedAt} END`,
        },
      })
      .returning({ totalHits: signInAttempts.attempts, started: signInAttempts.windowStartedAt });
    return {
      totalHits: row!.totalHits,
      resetTime: new Date(row!.started.getTime() + this.windowMs),
    };
  }
  async decrement(key: string) {
    await this.database
      .update(signInAttempts)
      .set({ attempts: sql`GREATEST(${signInAttempts.attempts}-1, 0)` })
      .where(eq(signInAttempts.identifierDigest, this.key(key)));
  }
  async resetKey(key: string) {
    await this.database
      .delete(signInAttempts)
      .where(eq(signInAttempts.identifierDigest, this.key(key)));
  }
}

export function authenticationLimiters(stores: {
  loginAddress: Store;
  loginAccount: Store;
  registration: Store;
}) {
  const options = {
    windowMs: 15 * 60_000,
    standardHeaders: "draft-8" as const,
    legacyHeaders: false,
    message: { error: { code: "rate_limited", message: "Too many attempts. Try again later." } },
  };
  return {
    loginAddress: rateLimit({
      ...options,
      limit: 100,
      store: stores.loginAddress,
    }),
    loginAccount: rateLimit({
      ...options,
      limit: 20,
      store: stores.loginAccount,
      keyGenerator: (request) => {
        const username =
          typeof request.body?.username === "string"
            ? request.body.username.trim().slice(0, 128).toLowerCase()
            : "";
        return username || "invalid";
      },
    }),
    registration: rateLimit({
      ...options,
      limit: 10,
      store: stores.registration,
    }),
  };
}
