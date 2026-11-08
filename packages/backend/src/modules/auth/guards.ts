import { RequestError } from "arrow-express";
import type { Request } from "express";
import type { Database } from "../../database/client.ts";
import { resolveSession } from "./sessions.ts";

export type Actor = { accountId: string; sessionId: string };

export function requireWriteOrigin(request: Request) {
  const origin = request.get("origin");
  const configuredOrigin = process.env.APP_ORIGIN;
  const host = request.get("host");
  const localHost = host && /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host);
  const localOrigin = process.env.NODE_ENV !== "production" && localHost && origin === `http://${host}`;
  if (!origin || !(configuredOrigin ? origin === configuredOrigin : localOrigin)) {
    throw new RequestError(403, { error: { code: "forbidden", message: "Invalid request origin." } });
  }
}

export async function requireActor(database: Database, request: Request): Promise<Actor> {
  const cookie = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("rpg_session="));
  const actor = cookie ? await resolveSession(database, cookie.slice("rpg_session=".length)) : null;
  if (!actor) {
    throw new RequestError(401, { error: { code: "unauthorized", message: "Sign in to continue." } });
  }
  return actor;
}
