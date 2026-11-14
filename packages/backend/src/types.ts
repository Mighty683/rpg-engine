import type { Express } from "express";
import type { EventStreamOptions } from "./modules/events/types.ts";

/** Runtime settings consumed by services; validation remains the composition layer's concern. */
export interface Configuration {
  production: boolean;
  development: boolean;
  databaseUrl: string | undefined;
  port: number;
  appOrigin: string | undefined;
  trustedProxies: string[];
  csrfSecret: string | undefined;
  invitationSecret: string | undefined;
}

export type ApplicationOptions = { eventStreams?: Partial<EventStreamOptions> };

/** The runtime wave exposes this alongside the backwards-compatible createApp function. */
export interface ApplicationRuntime {
  app: Express;
  dispose(): void;
}

export type ShutdownOptions = { timeoutMs?: number };
export const defaultShutdownTimeoutMs = 10_000;
