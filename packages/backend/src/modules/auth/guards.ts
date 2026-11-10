import type { Actor } from "./types.ts";
import { RequestError } from "arrow-express";
import type { Request } from "express";
import type { Configuration } from "../../types.ts";
import type { resolveSession } from "./sessions.ts";

export function requireWriteOrigin(config: Configuration, request: Request) {
  const origin = request.get("origin");
  const configuredOrigin = config.appOrigin;
  // Development without an explicit APP_ORIGIN accepts any origin so local
  // tooling (vite proxy, localhost vs 127.0.0.1, any port) works out of the box.
  const allowed = configuredOrigin ? origin === configuredOrigin : !config.production;
  if (!allowed) {
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
