import type { Response } from "express";

export type GameEvent =
  | { type: "roster" }
  | { type: "sheet"; characterId: string }
  | { type: "throws" }
  | { type: "npcs" };

export type Subscription = {
  gameId: string;
  accountId: string;
  sessionId: string;
  response: Response;
  active: boolean;
  close: () => void;
};

export interface GameEventPublisher {
  publishGameEvent(gameId: string, event: GameEvent, accountId?: string): void;
}

export interface StreamRevoker {
  closeSessionStreams(sessionId: string): void;
  closeMemberStreams(gameId: string, accountId: string): void;
}

/** Registered before asynchronous authorization so revocation can cancel pending setup. */
export interface StreamRegistration {
  start(): boolean;
  remove(): void;
}

export interface StreamRegistrar {
  registerStream(
    gameId: string,
    accountId: string,
    sessionId: string,
    response: Response,
  ): StreamRegistration;
}

/** Compatibility aggregate for existing consumers while they migrate to narrower capabilities. */
export interface GameEvents extends GameEventPublisher, StreamRevoker, StreamRegistrar {}

export interface EventLifecycle {
  /** Idempotently close pending/active streams and reject subsequent registration. */
  dispose(): void;
}

/** Runtime wave implements this lifecycle in addition to the existing event methods. */
export interface ManagedGameEvents extends GameEvents, EventLifecycle {}

export type EventStreamOptions = {
  maxConnectionsPerAccount: number;
  maxConnections: number;
  heartbeatIntervalMs: number;
  retryAfterSeconds: number;
};

/** Runtime maps capacity failures to 429 before SSE headers, with Retry-After. */
export type StreamCapacityError = Error & { code: "stream_capacity" };
