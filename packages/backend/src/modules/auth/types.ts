import type { Request } from "express";
import type { ValidationFields } from "../../shared/validation/types.ts";

export type CredentialsInput = { username: string; password: string };
export type CredentialsValidation = CredentialsInput & { fields: ValidationFields };

type Account = { id: string; username: string };
export interface AuthService {
  requireActor(request: Request): Promise<Actor>;
  requireWriteOrigin(request: Request): void;
  authenticateAccount(
    username: string,
    password: string,
  ): Promise<{ status: "invalid" } | { status: "ok"; account: Account }>;
  getAccount(accountId: string): Promise<Account | null>;
  registerAccount(username: string, password: string): Promise<Account>;
  createSession(accountId: string, expiresAt: Date): Promise<{ sessionId: string; token: string }>;
  logout(sessionId: string): Promise<void>;
}

export type Actor = { accountId: string; sessionId: string };

export interface SessionService {
  create(accountId: string, expiresAt: Date): Promise<{ sessionId: string; token: string }>;
  resolve(this: void, token: string): Promise<Actor | null>;
  revoke(this: void, sessionId: string): Promise<void>;
}
