import { Controller, RequestError, Route } from "arrow-express";
import type { AuthService } from "../auth/types.ts";
import type { GameActor, GamesService } from "../games/types.ts";
import { routeId } from "../../shared/http/route-id.ts";
import { badRequest } from "../../shared/http/errors.ts";
import { parseCreateNote, parseNoteListQuery, parseUpdateNote } from "./contract.ts";
import { decodeNotePageCursor, noteQueryHash } from "./cursor.ts";
import type { GameNotesService } from "./types.ts";

type Context = { actor: GameActor; gameId: string };

function requestError(error: unknown): never {
  const e = error as { code?: string };
  if (e.code === "not_found") throw new RequestError(404, { error: { code: e.code } });
  if (e.code === "forbidden") throw new RequestError(403, { error: { code: e.code } });
  if (e.code === "id_conflict" || e.code === "stale_revision")
    throw new RequestError(409, {
      error: { code: e.code },
    });
  throw error;
}

export function gameNotesController(services: {
  auth: AuthService;
  games: GamesService;
  notes: GameNotesService;
}) {
  return Controller()
    .prefix("games/:gameId/notes")
    .handler(async (request) => {
      if (request.method !== "GET") services.auth.requireWriteOrigin(request);
      const actor = await services.auth.requireActor(request);
      const gameId = routeId(request.params.gameId);
      if (!(await services.games.gameAccess(actor, gameId)))
        throw new RequestError(404, { error: { code: "not_found" } });
      return { actor, gameId };
    })
    .registerRoutes(
      Route<Context>()
        .method("get")
        .path("")
        .handler(async (request, _response, context) => {
          try {
            const query = parseNoteListQuery(request.query as Record<string, unknown>);
            const scope = { gameId: context.gameId, queryHash: noteQueryHash(query.q) };
            const position = query.cursor ? decodeNotePageCursor(query.cursor, scope) : null;
            if (query.cursor && !position) badRequest("Invalid cursor.");
            return await services.notes.list(context.actor, context.gameId, {
              q: query.q,
              position,
            });
          } catch (error) {
            requestError(error);
          }
        }),
      Route<Context>()
        .method("get")
        .path(":entryId")
        .handler(async (request, _response, context) => {
          try {
            return {
              entry: await services.notes.read(
                context.actor,
                context.gameId,
                routeId(request.params.entryId),
              ),
            };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<Context>()
        .method("post")
        .path("")
        .handler(async (request, response, context) => {
          const input = parseCreateNote(request.body);
          try {
            const entry = await services.notes.create(context.actor, context.gameId, input);
            response.status(201);
            return { entry };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<Context>()
        .method("patch")
        .path(":entryId")
        .handler(async (request, _response, context) => {
          const input = parseUpdateNote(request.body);
          try {
            return {
              entry: await services.notes.update(
                context.actor,
                context.gameId,
                routeId(request.params.entryId),
                input,
              ),
            };
          } catch (error) {
            requestError(error);
          }
        }),
    );
}
