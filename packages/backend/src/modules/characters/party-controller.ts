import { Controller, RequestError, Route } from "arrow-express";
import type { Pool } from "pg";
import { requireActor } from "../auth/guards.ts";
import { routeId } from "../games/controller.ts";
import { listActiveParty } from "./party-service.ts";

export function partyController(pool: Pool) {
  return Controller()
    .prefix("games/:gameId/party")
    .handler(async (request) => {
      const actor = await requireActor(pool, request);
      return { actor, gameId: routeId(request.params.gameId) };
    })
    .registerRoutes(
      Route<{ actor: { accountId: string; sessionId: string }; gameId: string }>().method("get").path("").handler(async (_request, _response, context) => {
        try {
          return await listActiveParty(pool, context.actor, context.gameId);
        } catch (error) {
          if ((error as { code?: string }).code === "not_found")
            throw new RequestError(404, { error: { code: "not_found", message: "Game not found." } });
          throw error;
        }
      }),
    );
}
