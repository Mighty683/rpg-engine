import type { AuthService } from "../auth/types.ts";
import type { GamesService, GameActor } from "./types.ts";
import { Controller, RequestError, Route } from "arrow-express";

import { validateGame, parseGameEnvelope } from "./contract.ts";
import { routeId } from "../../shared/http/route-id.ts";

export function gamesController(services: { auth: AuthService; games: GamesService }) {
  return Controller()
    .prefix("games")
    .handler(async (request) => {
      if (request.method !== "GET") services.auth.requireWriteOrigin(request);
      return services.auth.requireActor(request);
    })
    .registerRoutes(
      Route<GameActor>()
        .method("get")
        .path("")
        .handler(async (_request, _response, actor) => ({
          games: await services.games.listActorGames(actor),
        })),
      Route<GameActor>()
        .method("post")
        .path("")
        .handler(async (request, response, actor) => {
          const body = parseGameEnvelope(request.body);
          const { name, systemId, fields } = validateGame(body);
          if (Object.keys(fields).length) {
            throw new RequestError(422, {
              error: { code: "validation", message: "Check the fields.", fields },
            });
          }
          const game = await services.games.createActorGame(actor, name, systemId);
          response.status(201);
          return { game };
        }),
      Route<GameActor>()
        .method("get")
        .path(":gameId")
        .handler(async (request, _response, actor) => {
          const gameId = routeId(request.params.gameId);
          const game = await services.games.getActorGame(actor, gameId);
          if (!game)
            throw new RequestError(404, {
              error: { code: "not_found", message: "Game not found." },
            });
          return { game };
        }),
    );
}

export { routeId } from "../../shared/http/route-id.ts";
