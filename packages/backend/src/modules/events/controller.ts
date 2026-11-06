import { Controller, RequestError, Route } from "arrow-express";
import type { Pool } from "pg";
import { requireActor, type Actor } from "../auth/guards.ts";
import { gameAccess } from "../games/service.ts";
import { registerStream } from "./streams.ts";

export function gameEventsController(pool: Pool) {
  return Controller().prefix("games/:gameId/events").handler(async (request) => {
    const actor = await requireActor(pool, request);
    const gameId = String(request.params.gameId);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gameId)) {
      throw new RequestError(400, { error: { code: "bad_request", message: "Invalid identifier." } });
    }
    if (!await gameAccess(pool, actor, gameId)) {
      throw new RequestError(404, { error: { code: "not_found", message: "Game not found." } });
    }
    return { actor, gameId };
  }).registerRoutes(Route<{ actor: Actor; gameId: string }>().method("get").path("").handler(async (request, response, context) => {
    const { actor, gameId } = context;
    const stream = registerStream(gameId, actor.accountId, actor.sessionId, response);
    try {
      const current = await requireActor(pool, request);
      if (current.sessionId !== actor.sessionId || !await gameAccess(pool, current, gameId)) {
        throw new RequestError(404, { error: { code: "not_found", message: "Game not found." } });
      }
      if (!stream.start()) return;
      response.status(200);
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("X-Accel-Buffering", "no");
      response.flushHeaders();
      response.write(": connected\n\n");
      await new Promise<void>((resolve) => {
        const heartbeat = setInterval(() => {
          void (async () => {
            try {
              const currentActor = await requireActor(pool, request);
              if (!await gameAccess(pool, currentActor, gameId)) return response.end();
              response.write(": heartbeat\n\n");
            } catch {
              response.end();
            }
          })();
        }, 15_000);
        response.once("close", () => { clearInterval(heartbeat); response.end(); resolve(); });
      });
    } finally {
      stream.remove();
    }
  }));
}
