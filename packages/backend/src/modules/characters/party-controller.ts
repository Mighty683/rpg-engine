import type { AuthService } from "../auth/types.ts";
import type { CharactersService } from "./types.ts";
import { Controller, RequestError, Route } from "arrow-express";

import { routeId } from "../games/controller.ts";

export function partyController(services: { auth: AuthService; characters: CharactersService }) {
  return Controller()
    .prefix("games/:gameId/party")
    .handler(async (request) => {
      const actor = await services.auth.requireActor(request);
      return { actor, gameId: routeId(request.params.gameId) };
    })
    .registerRoutes(
      Route<{ actor: { accountId: string; sessionId: string }; gameId: string }>().method("get").path("").handler(async (_request, _response, context) => {
        try {
          return await services.characters.listActiveParty(context.actor, context.gameId);
        } catch (error) {
          if ((error as { code?: string }).code === "not_found")
            throw new RequestError(404, { error: { code: "not_found", message: "Game not found." } });
          throw error;
        }
      }),
    );
}
