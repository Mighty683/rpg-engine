import type { CharacterContext, CharactersService } from "./types.ts";
import type { AuthService } from "../auth/types.ts";
import type { GamesService } from "../games/types.ts";
import { Controller, RequestError, Route } from "arrow-express";

import { routeId } from "../games/controller.ts";

function requestError(error: unknown): never {
  const e = error as { code?: string; message?: string; field?: string };
  if (e.code === "not_found")
    throw new RequestError(404, { error: { code: e.code, message: "Character not found." } });
  if (e.code === "forbidden")
    throw new RequestError(403, { error: { code: e.code, message: "Action not permitted." } });
  if (e.code === "stale_revision" || e.code === "id_conflict")
    throw new RequestError(409, {
      error: { code: e.code, message: "The request conflicts with current state." },
    });
  if (e.code === "validation")
    throw new RequestError(422, {
      error: { code: e.code, message: e.message, fields: { [e.field ?? "sheet"]: e.message } },
    });
  throw error;
}
function badRequest(): never {
  throw new RequestError(400, { error: { code: "bad_request", message: "Invalid request." } });
}
function validId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

export function charactersController(services: {
  auth: AuthService;
  games: GamesService;
  characters: CharactersService;
}) {
  return Controller()
    .prefix("games/:gameId/characters")
    .handler(async (request) => {
      if (request.method !== "GET") services.auth.requireWriteOrigin(request);
      const actor = await services.auth.requireActor(request);
      const gameId = routeId(request.params.gameId);
      const access = await services.games.gameAccess(actor, gameId);
      if (!access)
        throw new RequestError(404, { error: { code: "not_found", message: "Game not found." } });
      if (request.params.characterId && request.method !== "GET") {
        const characterId = routeId(request.params.characterId);
        try {
          const character = await services.characters.getWorkspaceCharacter(
            actor,
            gameId,
            characterId,
          );
          const isGmAction =
            request.path.endsWith("/active") || request.path.endsWith("/controller");
          if ((isGmAction && access.role !== "GM") || (!isGmAction && !character.canEdit)) {
            throw new RequestError(403, {
              error: { code: "forbidden", message: "Action not permitted." },
            });
          }
        } catch (error) {
          requestError(error);
        }
      }
      return { actor, gameId, access };
    })
    .registerRoutes(
      Route<CharacterContext>()
        .method("get")
        .path("")
        .handler(async (_request, _response, context) => {
          try {
            return {
              characters: await services.characters.listWorkspaceCharacters(
                context.actor,
                context.gameId,
              ),
            };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<CharacterContext>()
        .method("post")
        .path("")
        .handler(async (request, response, context) => {
          const body = request.body;
          if (!body || typeof body !== "object" || Array.isArray(body) || !validId(body.id))
            badRequest();
          const name = typeof body.name === "string" ? body.name.trim() : "";
          if (!name || Array.from(name).length > 100) {
            throw new RequestError(422, {
              error: {
                code: "validation",
                message: "Check the fields.",
                fields: { name: "Enter a character name of at most 100 characters." },
              },
            });
          }
          try {
            const created = await services.characters.createWorkspaceCharacter(
              context.actor,
              context.gameId,
              body.id,
              name,
            );
            response.status(created.created ? 201 : 200);
            return { character: created.record };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<CharacterContext>()
        .method("get")
        .path(":characterId")
        .handler(async (request, _response, context) => {
          try {
            return {
              character: await services.characters.getWorkspaceCharacter(
                context.actor,
                context.gameId,
                routeId(request.params.characterId),
              ),
            };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<CharacterContext>()
        .method("patch")
        .path(":characterId")
        .handler(async (request, _response, context) => {
          const body = request.body;
          if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body) ||
            !Number.isInteger(body.expectedRevision) ||
            body.expectedRevision < 0 ||
            !body.changes ||
            typeof body.changes !== "object" ||
            Array.isArray(body.changes)
          )
            badRequest();
          try {
            return {
              character: await services.characters.updateWorkspaceCharacter(
                context.gameId,
                context.actor,
                routeId(request.params.characterId),
                body.expectedRevision,
                body.changes,
              ),
            };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<CharacterContext>()
        .method("put")
        .path(":characterId/active")
        .handler(async (request, _response, context) => {
          if (!request.body || typeof request.body.active !== "boolean") badRequest();
          try {
            return {
              character: await services.characters.setGmCharacterActive(
                context.actor,
                context.gameId,
                routeId(request.params.characterId),
                request.body.active,
              ),
            };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<CharacterContext>()
        .method("patch")
        .path(":characterId/controller")
        .handler(async (request, _response, context) => {
          const body = request.body;
          if (
            !body ||
            typeof body !== "object" ||
            !(body.membershipId === null || validId(body.membershipId))
          )
            badRequest();
          try {
            return {
              character: await services.characters.assignCharacter(
                context.actor,
                context.gameId,
                routeId(request.params.characterId),
                body.membershipId,
              ),
            };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<CharacterContext>()
        .method("delete")
        .path(":characterId")
        .handler(async (request, _response, context) => {
          try {
            await services.characters.deleteWorkspaceCharacter(
              context.actor,
              context.gameId,
              routeId(request.params.characterId),
            );
            return { deleted: true };
          } catch (error) {
            requestError(error);
          }
        }),
    );
}
