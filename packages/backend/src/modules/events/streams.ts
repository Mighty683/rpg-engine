import type { Subscription, GameEvent, ManagedGameEvents, EventStreamOptions } from "./types.ts";
import type { Response } from "express";

export const defaultEventStreamOptions: Readonly<EventStreamOptions> = Object.freeze({
  maxConnectionsPerAccount: 8,
  maxConnections: 256,
  heartbeatIntervalMs: 15_000,
  retryAfterSeconds: 15,
});

export function eventStreamOptions(
  overrides: Partial<EventStreamOptions> = {},
): EventStreamOptions {
  const options = { ...defaultEventStreamOptions, ...overrides };
  for (const [name, value] of Object.entries(options)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(`Event stream option ${name} must be a positive integer`);
  }
  return options;
}

/** Transport failures are isolated so revocation/disposal can always finish the remaining streams. */
function closeTransport(response: Response, slow: boolean) {
  try {
    if (slow) response.destroy();
    else response.end();
  } catch {
    try {
      response.destroy();
    } catch {
      /* Capacity is already released. */
    }
  }
}

function writeEvent(response: Response, data: string) {
  try {
    return !response.destroyed && !response.writableEnded && response.write(data);
  } catch {
    return false;
  }
}

function matchesAudience(stream: Subscription, gameId: string, accountId?: string) {
  return (
    stream.active && stream.gameId === gameId && (!accountId || stream.accountId === accountId)
  );
}

/** Pending and active connections share the same limits; every release is idempotent. */
export function createGameEvents(overrides: Partial<EventStreamOptions> = {}): ManagedGameEvents {
  const options = eventStreamOptions(overrides);
  const subscriptions = new Set<Subscription>();
  const accountCounts = new Map<string, number>();
  let disposed = false;

  function release(subscription: Subscription) {
    if (!subscriptions.delete(subscription)) return;
    const remaining = (accountCounts.get(subscription.accountId) ?? 1) - 1;
    if (remaining) accountCounts.set(subscription.accountId, remaining);
    else accountCounts.delete(subscription.accountId);
  }

  function close(subscription: Subscription, slow = false) {
    release(subscription);
    closeTransport(subscription.response, slow);
  }

  function registerStream(
    gameId: string,
    accountId: string,
    sessionId: string,
    response: Response,
  ) {
    if (disposed) throw Object.assign(new Error("Server is stopping"), { code: "server_stopping" });
    if (response.destroyed || response.writableEnded)
      return { start: () => false, remove: () => {} };
    const count = accountCounts.get(accountId) ?? 0;
    if (subscriptions.size >= options.maxConnections || count >= options.maxConnectionsPerAccount)
      throw Object.assign(new Error("Too many live connections"), { code: "stream_capacity" });
    const subscription: Subscription = {
      gameId,
      accountId,
      sessionId,
      response,
      active: false,
      close: () => response.end(),
    };
    const remove = () => {
      release(subscription);
      response.off("close", remove);
    };
    subscriptions.add(subscription);
    accountCounts.set(accountId, count + 1);
    response.once("close", remove);
    return {
      start() {
        if (!subscriptions.has(subscription) || response.destroyed || response.writableEnded) {
          remove();
          return false;
        }
        subscription.active = true;
        return true;
      },
      remove,
    };
  }

  function publishGameEvent(gameId: string, event: GameEvent, accountId?: string) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const stream of subscriptions) {
      if (!matchesAudience(stream, gameId, accountId)) continue;
      if (!writeEvent(stream.response, data)) close(stream, true);
    }
  }

  function closeSessionStreams(sessionId: string) {
    for (const stream of subscriptions) if (stream.sessionId === sessionId) close(stream);
  }

  function closeMemberStreams(gameId: string, accountId: string) {
    for (const stream of subscriptions)
      if (stream.gameId === gameId && stream.accountId === accountId) close(stream);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const stream of subscriptions) close(stream);
  }

  return { registerStream, publishGameEvent, closeSessionStreams, closeMemberStreams, dispose };
}
