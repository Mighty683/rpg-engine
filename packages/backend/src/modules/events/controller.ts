import type { AuthService, Actor } from "../auth/types.ts";
import type { GameEvents, EventStreamOptions } from "./types.ts";
import type { GamesService } from "../games/types.ts";
import { Controller, RequestError, Route } from "arrow-express";
import { routeId } from "../../shared/http/route-id.ts";
import { defaultEventStreamOptions } from "./streams.ts";
import { startHeartbeat } from "./heartbeat.ts";

export function gameEventsController(
  services: {
    auth: AuthService;
    games: GamesService;
    events: GameEvents;
  },
  options: EventStreamOptions = defaultEventStreamOptions,
) {
  return Controller()
    .prefix("games/:gameId/events")
    .handler(async (request) => {
      const actor = await services.auth.requireActor(request);
      const gameId = routeId(request.params.gameId);
      if (!(await services.games.gameAccess(actor, gameId)))
        throw new RequestError(404, { error: { code: "not_found", message: "Game not found." } });
      return { actor, gameId };
    })
    .registerRoutes(
      Route<{ actor: Actor; gameId: string }>()
        .method("get")
        .path("")
        .handler(async (request, response, { actor, gameId }) => {
          let stream;
          try {
            stream = services.events.registerStream(
              gameId,
              actor.accountId,
              actor.sessionId,
              response,
            );
          } catch (error) {
            const code = (error as { code?: string }).code;
            if (code !== "stream_capacity" && code !== "server_stopping") throw error;
            response.setHeader("Retry-After", String(options.retryAfterSeconds));
            throw new RequestError(code === "stream_capacity" ? 429 : 503, {
              error: {
                code,
                message:
                  code === "stream_capacity" ? "Too many live connections." : "Server is stopping.",
              },
            });
          }
          let stopHeartbeat = () => {};
          try {
            const current = await services.auth.requireActor(request);
            if (
              current.sessionId !== actor.sessionId ||
              !(await services.games.gameAccess(current, gameId))
            )
              throw new RequestError(404, {
                error: { code: "not_found", message: "Game not found." },
              });
            if (!stream.start()) return;
            const closed = new Promise<void>((resolve) => response.once("close", resolve));
            response.status(200);
            response.setHeader("Content-Type", "text/event-stream");
            response.setHeader("Cache-Control", "no-cache, no-transform");
            response.setHeader("X-Accel-Buffering", "no");
            response.flushHeaders();
            if (!response.write(": connected\n\n")) response.destroy();
            stopHeartbeat = startHeartbeat(
              async () => {
                const currentActor = await services.auth.requireActor(request);
                return (
                  currentActor.sessionId === actor.sessionId &&
                  !!(await services.games.gameAccess(currentActor, gameId))
                );
              },
              () =>
                !response.destroyed && !response.writableEnded && response.write(": heartbeat\n\n"),
              () => response.destroy(),
              options.heartbeatIntervalMs,
            );
            response.once("close", stopHeartbeat);
            await closed;
          } finally {
            stopHeartbeat();
            response.off("close", stopHeartbeat);
            stream.remove();
          }
        }),
    );
}
