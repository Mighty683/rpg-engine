import type { AuthService, Actor } from "../auth/types.ts";
import type { GameEvents } from "./types.ts";
import type { GamesService } from "../games/types.ts";
import { Controller, RequestError, Route } from "arrow-express";

export function gameEventsController(services: {
  auth: AuthService;
  games: GamesService;
  events: GameEvents;
}) {
  return Controller()
    .prefix("games/:gameId/events")
    .handler(async (request) => {
      const actor = await services.auth.requireActor(request);
      const gameId = String(request.params.gameId);
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gameId)
      ) {
        throw new RequestError(400, {
          error: { code: "bad_request", message: "Invalid identifier." },
        });
      }
      if (!(await services.games.gameAccess(actor, gameId))) {
        throw new RequestError(404, { error: { code: "not_found", message: "Game not found." } });
      }
      return { actor, gameId };
    })
    .registerRoutes(
      Route<{ actor: Actor; gameId: string }>()
        .method("get")
        .path("")
        .handler(async (request, response, context) => {
          const { actor, gameId } = context;
          const stream = services.events.registerStream(
            gameId,
            actor.accountId,
            actor.sessionId,
            response,
          );
          try {
            const current = await services.auth.requireActor(request);
            if (
              current.sessionId !== actor.sessionId ||
              !(await services.games.gameAccess(current, gameId))
            ) {
              throw new RequestError(404, {
                error: { code: "not_found", message: "Game not found." },
              });
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
                    const currentActor = await services.auth.requireActor(request);
                    if (!(await services.games.gameAccess(currentActor, gameId)))
                      return response.end();
                    response.write(": heartbeat\n\n");
                  } catch {
                    response.end();
                  }
                })();
              }, 15_000);
              response.once("close", () => {
                clearInterval(heartbeat);
                response.end();
                resolve();
              });
            });
          } finally {
            stream.remove();
          }
        }),
    );
}
