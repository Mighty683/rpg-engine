import type { createAuthService } from "./factory.ts";
import type { createSessionService } from "./sessions.ts";

export type AuthService = ReturnType<typeof createAuthService>;

export type Actor = { accountId: string; sessionId: string };

export type SessionService = ReturnType<typeof createSessionService>;
