import type { SessionService } from "./types.ts";
import type { GameEvents } from "../events/types.ts";
import type { Request } from "express";
import { requireActor, requireWriteOrigin } from "./guards.ts";
import { authenticateAccount, getAccount, logout, registerAccount } from "./service.ts";

import type { Database } from "../../database/types.ts";
import type { Configuration } from "../../types.ts";

export function createAuthService(
  database: Database,
  config: Configuration,
  events: GameEvents,
  sessions: SessionService,
) {
  return {
    requireActor: (request: Request) => requireActor(sessions.resolve, request),
    requireWriteOrigin: (request: Request) => requireWriteOrigin(config, request),
    authenticateAccount: (username: string, password: string) =>
      authenticateAccount(database, username, password),
    getAccount: (accountId: string) => getAccount(database, accountId),
    registerAccount: (username: string, password: string) =>
      registerAccount(database, username, password),
    createSession: (accountId: string, expiresAt: Date) => sessions.create(accountId, expiresAt),
    logout: (sessionId: string) => logout(events, sessions.revoke, sessionId),
  };
}

