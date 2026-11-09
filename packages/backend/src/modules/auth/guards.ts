import type { Actor } from "./types.ts";
import { RequestError } from "arrow-express";
import type { Request } from "express";
import type { Configuration } from "../../types.ts";
import type { resolveSession } from "./sessions.ts";

export function requireWriteOrigin(config: Configuration, request: Request) {
  const origin = request.get("origin");
  const configuredOrigin = config.appOrigin;
  const host = request.get("host");
  const localHost = host && /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host);
  const localOrigin = !config.production && localHost && origin === `http://${host}`;
  if (!origin || !(configuredOrigin ? origin === configuredOrigin : localOrigin)) {
    throw new RequestError(403, {
      error: { code: "forbidden", message: "Invalid request origin." },
    });
  }
}

export async function requireActor(
  resolve: (token: string) => ReturnType<typeof resolveSession>,
  request: Request,
): Promise<Actor> {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("rpg_session="));
  const actor = cookie ? await resolve(cookie.slice("rpg_session=".length)) : null;
  if (!actor) {
    throw new RequestError(401, {
      error: { code: "unauthorized", message: "Sign in to continue." },
    });
  }
  return actor;
}
