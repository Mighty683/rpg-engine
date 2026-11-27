import { rateLimit, type Store } from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import type { MutationLimitOptions } from "./types.ts";

/** Limits mutations by authenticated account, shared across sessions and game routes. */
export function mutationLimiter(
  authorize: (request: Request) => Promise<{ accountId: string }>,
  store: Store,
  overrides: Partial<MutationLimitOptions> = {},
): RequestHandler {
  const options = { windowMs: 60_000, limit: 60, ...overrides };
  for (const value of Object.values(options)) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647)
      throw new Error("Mutation limits must be positive 32-bit integers");
  }
  const accounts = new WeakMap<Request, string>();
  const limit = rateLimit({
    ...options,
    store,
    keyGenerator: (request) => accounts.get(request)!,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: { code: "ERR86" } },
  });
  return async (request, response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      next();
      return;
    }
    try {
      const actor = await authorize(request);
      accounts.set(request, actor.accountId);
      await limit(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}
