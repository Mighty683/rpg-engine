import { Controller, RequestError, Route } from "arrow-express";
import type { Pool } from "pg";
import { createGame, getGame, listGames, validateGame } from "./service.ts";
const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const gameDetailHandler = (pool: Pool) => async (request: any) => {
  const id = Array.isArray(request.params.gameId)
    ? request.params.gameId[0]!
    : request.params.gameId;
  if (!uuid(id))
    throw new RequestError(400, { error: { code: "bad_request", message: "Invalid identifier." } });
  const game = await getGame(pool, id);
  if (!game)
    throw new RequestError(404, { error: { code: "not_found", message: "Game not found." } });
  return { game };
};

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
      Route().method("get").path(":gameId").handler(gameDetailHandler(pool)),
    );
}
