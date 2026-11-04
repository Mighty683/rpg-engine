import { Controller, RequestError, Route } from "arrow-express";
import type { Pool } from "pg";
import { createGame, listGames, validateGame } from "./service.ts";

export function gamesController(pool: Pool) {
  return Controller()
    .prefix("games")
    .registerRoutes(
      Route()
        .method("get")
        .path("")
        .handler(async () => {
          try {
            return { games: await listGames(pool) };
          } catch {
            throw new RequestError(500, {
              error: { code: "list_failed", message: "Could not load games." },
            });
          }
        }),
      Route()
        .method("post")
        .path("")
        .handler(async (request, response) => {
          if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
            throw new RequestError(400, {
              error: { code: "bad_request", message: "Expected a JSON object." },
            });
          }
          const { name, systemId, fields } = validateGame(request.body);
          if (Object.keys(fields).length) {
            throw new RequestError(422, {
              error: { code: "validation", message: "Check the fields.", fields },
            });
          }
          try {
            const game = await createGame(pool, name, systemId);
            response.status(201);
            return { game };
          } catch {
            throw new RequestError(500, {
              error: { code: "save_failed", message: "Could not confirm creation." },
            });
          }
        }),
    );
}
