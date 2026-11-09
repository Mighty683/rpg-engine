import type { Subscription, GameEvent } from "./types.ts";
import type { Response } from "express";

export function createGameEvents() {
  const subscriptions = new Set<Subscription>();

  /** Register before asynchronous access checks so revocation can cancel setup. */
  function registerStream(
    gameId: string,
    accountId: string,
    sessionId: string,
    response: Response,
  ) {
    const subscription: Subscription = {
      gameId,
      accountId,
      sessionId,
      response,
      active: false,
      close: () => response.end(),
    };
    subscriptions.add(subscription);
    return {
      start() {
        if (!subscriptions.has(subscription) || response.destroyed || response.writableEnded)
          return false;
        subscription.active = true;
        return true;
      },
      remove() {
        subscriptions.delete(subscription);
      },
    };
  }

  function publishGameEvent(gameId: string, event: GameEvent) {
    for (const stream of subscriptions) {
      if (stream.gameId === gameId && stream.active) {
        stream.response.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    }
  }

  function closeSessionStreams(sessionId: string) {
    for (const stream of subscriptions) {
      if (stream.sessionId === sessionId) {
        subscriptions.delete(stream);
        stream.close();
      }
    }
  }

  function closeMemberStreams(gameId: string, accountId: string) {
    for (const stream of subscriptions) {
      if (stream.gameId === gameId && stream.accountId === accountId) {
        subscriptions.delete(stream);
        stream.close();
      }
    }
  }

  return { registerStream, publishGameEvent, closeSessionStreams, closeMemberStreams };
}
