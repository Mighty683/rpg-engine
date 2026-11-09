import type { ThrowContext, ThrowsService, CreateThrowInput } from "./types.ts";
import type { AuthService } from "../auth/types.ts";
import type { GamesService } from "../games/types.ts";
import { Controller, RequestError, Route } from "arrow-express";

import { routeId } from "../games/controller.ts";

import { fail, parseCreateRequest } from "./contract.ts";

const pageLimit = (value: unknown) => {
  const limit = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 20;
  return Math.min(Math.max(limit, 1), 100);
};

const cursor = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) <= 0) return null;
  return Number(value);
};

function requestError(error: unknown): never {
  const e = error as { code?: string; message?: string; field?: string };
  const statusByCode: Record<string, number> = {
    not_found: 404,
    forbidden: 403,
    stale_revision: 409,
    no_active_character: 409,
    inactive_character: 409,
    weapon_incomplete: 422,
    validation: 422,
    bad_request: 400,
  };
  const status = e.code ? statusByCode[e.code] : undefined;
  if (!status) throw error;
  if (status === 422)
    throw new RequestError(422, {
      error: {
        code: "validation",
        message: e.message ?? "Check the roll setup.",
        fields: { [e.field ?? "setup"]: e.message ?? "Check the roll setup." },
      },
    });
  if (status === 400)
    throw new RequestError(400, {
      error: { code: "bad_request", message: e.message ?? "Invalid request." },
    });
  const messages: Record<string, string> = {
    not_found: "Throw not found.",
    forbidden: "Action not permitted.",
    stale_revision: "The sheet changed since this roll was prepared.",
    no_active_character: "Select an active character before rolling.",
    inactive_character: "That character is no longer active.",
  };
  throw new RequestError(status, {
    error: { code: e.code!, message: messages[e.code!] ?? "Request failed." },
  });
}

export function throwsController(services: {
  auth: AuthService;
  games: GamesService;
  throws: ThrowsService;
}) {
  return Controller()
    .prefix("games/:gameId/throws")
    .handler(async (request) => {
      if (request.method !== "GET") services.auth.requireWriteOrigin(request);
      const actor = await services.auth.requireActor(request);
      const gameId = routeId(request.params.gameId);
      const access = await services.games.gameAccess(actor, gameId);
      if (!access)
        throw new RequestError(404, { error: { code: "not_found", message: "Game not found." } });
      return { actor, gameId };
    })
    .registerRoutes(
      Route<ThrowContext>()
        .method("get")
        .path("")
        .handler(async (request, _response, context) => {
          const query = request.query as Record<string, unknown>;
          try {
            return await services.throws.listThrows(
              context.actor,
              context.gameId,
              cursor(query.before),
              pageLimit(query.limit),
            );
          } catch (error) {
            requestError(error);
          }
        }),
      Route<ThrowContext>()
        .method("post")
        .path("")
        .handler(async (request, response, context) => {
          let input: CreateThrowInput;
          try {
            input = parseCreateRequest(request.body);
          } catch (error) {
            requestError(error);
          }
          try {
            const result = await services.throws.createThrow(context.actor, context.gameId, input);
            response.status(201);
            return { throw: result.record };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<ThrowContext>()
        .method("delete")
        .path(":throwId")
        .handler(async (request, _response, context) => {
          try {
            const result = await services.throws.removeThrow(
              context.actor,
              context.gameId,
              routeId(request.params.throwId),
            );
            return { deleted: result.deleted };
          } catch (error) {
            requestError(error);
          }
        }),
    );
}

export { fail };
