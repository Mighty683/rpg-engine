import { Controller, RequestError, Route } from "arrow-express";
import type { Pool } from "pg";
import { createPlayer, getPlayer, listPlayers, selectActive } from "./service.ts";
import {
  listCharacters,
  createCharacter,
  getCharacter,
  updateCharacter,
} from "../characters/service.ts";
import { getGame } from "../games/service.ts";
const bad = (message = "Expected a JSON object.") =>
  new RequestError(400, { error: { code: "bad_request", message } });
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const param = (v: string | string[]) => (Array.isArray(v) ? v[0]! : v);
const routeUuid = (v: string | string[]) => {
  const value = param(v);
  if (!uuid(value))
    throw new RequestError(400, { error: { code: "bad_request", message: "Invalid identifier." } });
  return value;
};
async function requireSupportedPlayer(pool: Pool, gameId: string, playerId: string) {
  if (!(await getPlayer(pool, gameId, playerId)))
    throw new RequestError(404, { error: { code: "not_found", message: "Player not found." } });
}
export function playersController(pool: Pool) {
  return Controller()
    .prefix("games/:gameId/players")
    .registerRoutes(
      Route()
        .method("get")
        .path("")
        .handler(async (r) => {
          const gameId = routeUuid(r.params.gameId);
          if (!(await getGame(pool, gameId)))
            throw new RequestError(404, {
              error: { code: "not_found", message: "Game not found." },
            });
          return { players: await listPlayers(pool, gameId) };
        }),
      Route()
        .method("post")
        .path("")
        .handler(async (r, res) => {
          const b = r.body;
          if (!b || typeof b !== "object" || !uuid(b.id)) throw bad();
          if (!(await getGame(pool, param(r.params.gameId))))
            throw new RequestError(404, {
              error: { code: "not_found", message: "Game not found." },
            });
          const name = typeof b.name === "string" ? b.name.trim() : "";
          if (!name || name.length > 20)
            throw new RequestError(422, {
              error: {
                code: "validation",
                message: "Check the fields.",
                fields: { name: "Enter a player name" },
              },
            });
          try {
            const p = await createPlayer(pool, param(r.params.gameId), b.id, name);
            res.status(p.created ? 201 : 200);
            return { player: p.record };
          } catch (e: any) {
            if (e.code === "id_conflict")
              throw new RequestError(409, {
                error: { code: e.code, message: "ID already belongs to another parent." },
              });
            throw e;
          }
        }),
      Route()
        .method("get")
        .path(":playerId")
        .handler(async (r) => {
          const gameId = routeUuid(r.params.gameId),
            playerId = routeUuid(r.params.playerId);
          const p = await getPlayer(pool, gameId, playerId);
          if (!p)
            throw new RequestError(404, {
              error: { code: "not_found", message: "Player not found." },
            });
          return { player: p };
        }),
      Route()
        .method("get")
        .path(":playerId/characters")
        .handler(async (r) => {
          const gameId = routeUuid(r.params.gameId),
            playerId = routeUuid(r.params.playerId);
          const player = await getPlayer(pool, gameId, playerId);
          if (!player)
            throw new RequestError(404, {
              error: { code: "not_found", message: "Player not found." },
            });
          return { characters: await listCharacters(pool, gameId, playerId) };
        }),
      Route()
        .method("post")
        .path(":playerId/characters")
        .handler(async (r, res) => {
          const b = r.body;
          if (!b || typeof b !== "object" || !uuid(b.id)) throw bad();
          const name = typeof b.name === "string" ? b.name.trim() : "";
          if (!name)
            throw new RequestError(422, {
              error: {
                code: "validation",
                message: "Check the fields.",
                fields: { name: "Enter a character name" },
              },
            });
          try {
            await requireSupportedPlayer(
              pool,
              routeUuid(r.params.gameId),
              routeUuid(r.params.playerId),
            );
            const c = await createCharacter(
              pool,
              routeUuid(r.params.gameId),
              routeUuid(r.params.playerId),
              b.id,
              name,
            );
            res.status(c.created ? 201 : 200);
            return { character: c.record };
          } catch (e: any) {
            if (e.code === "not_found")
              throw new RequestError(404, { error: { code: e.code, message: e.code } });
            if (e.code === "id_conflict")
              throw new RequestError(409, { error: { code: e.code, message: e.code } });
            throw e;
          }
        }),
      Route()
        .method("get")
        .path(":playerId/characters/:characterId")
        .handler(async (r) => {
          await requireSupportedPlayer(
            pool,
            routeUuid(r.params.gameId),
            routeUuid(r.params.playerId),
          );
          const c = await getCharacter(
            pool,
            routeUuid(r.params.gameId),
            routeUuid(r.params.playerId),
            routeUuid(r.params.characterId),
          );
          if (!c)
            throw new RequestError(404, {
              error: { code: "not_found", message: "Character not found." },
            });
          return { character: c };
        }),
      Route()
        .method("patch")
        .path(":playerId/characters/:characterId")
        .handler(async (r) => {
          const b = r.body;
          if (
            !b ||
            typeof b !== "object" ||
            !Number.isInteger(b.expectedRevision) ||
            !b.changes ||
            typeof b.changes !== "object"
          )
            throw bad();
          try {
            await requireSupportedPlayer(
              pool,
              routeUuid(r.params.gameId),
              routeUuid(r.params.playerId),
            );
            return {
              character: await updateCharacter(
                pool,
                routeUuid(r.params.gameId),
                routeUuid(r.params.playerId),
                routeUuid(r.params.characterId),
                b.expectedRevision,
                b.changes,
              ),
            };
          } catch (e: any) {
            if (e.code === "stale_revision")
              throw new RequestError(409, {
                error: { code: e.code, message: "Revision is stale." },
              });
            if (e.code === "validation")
              throw new RequestError(422, {
                error: {
                  code: e.code,
                  message: e.message,
                  fields: { [e.field ?? "sheet"]: e.message },
                },
              });
            if (e.code === "not_found")
              throw new RequestError(404, { error: { code: e.code, message: e.code } });
            throw e;
          }
        }),
      Route()
        .method("put")
        .path(":playerId/active-character")
        .handler(async (r) => {
          const b = r.body;
          if (
            !b ||
            typeof b !== "object" ||
            !Number.isInteger(b.expectedRevision) ||
            b.expectedRevision < 0 ||
            (b.characterId !== null && !uuid(b.characterId))
          )
            throw bad();
          try {
            const gameId = routeUuid(r.params.gameId),
              playerId = routeUuid(r.params.playerId);
            await requireSupportedPlayer(pool, gameId, playerId);
            const player = await selectActive(
              pool,
              gameId,
              playerId,
              b.expectedRevision,
              b.characterId ?? null,
            );
            if (!player)
              throw new RequestError(404, {
                error: { code: "not_found", message: "Player not found." },
              });
            return { player };
          } catch (e: any) {
            if (e.code === "stale_revision" || e.code === "not_found")
              throw new RequestError(e.code === "not_found" ? 404 : 409, {
                error: { code: e.code, message: e.code },
              });
            throw e;
          }
        }),
    );
}
