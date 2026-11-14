import { Controller, RequestError, Route } from "arrow-express";
import type { AuthService } from "../auth/types.ts";
import type { GamesService, GameActor } from "../games/types.ts";
import { routeId } from "../../shared/http/route-id.ts";
import {
  parseNpcWrite,
  parseNpcCreateEnvelope,
  parseNpcUpdateEnvelope,
  parseNpcRemoveEnvelope,
  parseNpcRevision,
} from "./contract.ts";
import type { createNpcsService } from "./service.ts";

type Context = { actor: GameActor; gameId: string };
function requestError(error: unknown): never {
  const e = error as { code?: string; field?: string; message?: string };
  if (e.code === "not_found")
    throw new RequestError(404, { error: { code: e.code, message: "NPC not found." } });
  if (e.code === "forbidden")
    throw new RequestError(403, { error: { code: e.code, message: "Action not permitted." } });
  if (e.code === "id_conflict" || e.code === "stale_revision")
    throw new RequestError(409, {
      error: { code: e.code, message: "The request conflicts with current state." },
    });
  if (e.code === "validation")
    throw new RequestError(422, {
      error: {
        code: e.code,
        message: "Check the fields.",
        fields: { [e.field ?? "npc"]: e.message ?? "Invalid value." },
      },
    });
  throw error;
}
export function npcsController(services: {
  auth: AuthService;
  games: GamesService;
  npcs: ReturnType<typeof createNpcsService>;
}) {
  return Controller()
    .prefix("games/:gameId/npcs")
    .handler(async (request) => {
      if (request.method !== "GET") services.auth.requireWriteOrigin(request);
      const actor = await services.auth.requireActor(request);
      const gameId = routeId(request.params.gameId);
      if (!(await services.games.gameAccess(actor, gameId)))
        throw new RequestError(404, { error: { code: "not_found", message: "Game not found." } });
      return { actor, gameId };
    })
    .registerRoutes(
      Route<Context>()
        .method("get")
        .path("")
        .handler(async (_request, _response, context) => {
          try {
            return { npcs: await services.npcs.read(context.actor, context.gameId) };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<Context>()
        .method("get")
        .path(":npcId")
        .handler(async (request, _response, context) => {
          try {
            const [npc] = await services.npcs.read(
              context.actor,
              context.gameId,
              routeId(request.params.npcId),
            );
            return { npc };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<Context>()
        .method("post")
        .path("")
        .handler(async (request, response, context) => {
          const body = parseNpcCreateEnvelope(request.body);
          try {
            const result = await services.npcs.write(
              context.actor,
              context.gameId,
              routeId(body.id as string),
              parseNpcWrite(body.npc),
            );
            response.status(result.created ? 201 : 200);
            return { npc: result.npc };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<Context>()
        .method("put")
        .path(":npcId")
        .handler(async (request, _response, context) => {
          const body = parseNpcUpdateEnvelope(request.body);
          try {
            const result = await services.npcs.write(
              context.actor,
              context.gameId,
              routeId(request.params.npcId),
              parseNpcWrite(body.npc),
              parseNpcRevision(body.expectedRevision),
            );
            return { npc: result.npc };
          } catch (error) {
            requestError(error);
          }
        }),
      Route<Context>()
        .method("delete")
        .path(":npcId")
        .handler(async (request, response, context) => {
          const body = parseNpcRemoveEnvelope(request.body);
          try {
            await services.npcs.remove(
              context.actor,
              context.gameId,
              routeId(request.params.npcId),
              parseNpcRevision(body.expectedRevision),
            );
            response.status(204);
            return;
          } catch (error) {
            requestError(error);
          }
        }),
    );
}
