import type { createAuthService } from "./factory.ts";
import type { createSessionService } from "./sessions.ts";
import type { ValidationFields } from "../../shared/validation/types.ts";

export type CredentialsInput = { username: string; password: string };
export type CredentialsValidation = CredentialsInput & { fields: ValidationFields };

export type AuthService = ReturnType<typeof createAuthService>;

export type Actor = { accountId: string; sessionId: string };

export type SessionService = ReturnType<typeof createSessionService>;
