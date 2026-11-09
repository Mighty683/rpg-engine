import type { GameContext, MembershipsService } from "./types.ts";
import type { AuthService } from "../auth/types.ts";
import type { GamesService } from "../games/types.ts";
import { Controller, RequestError, Route } from "arrow-express";
import type { Request } from "express";

const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const bad = () =>
  new RequestError(400, { error: { code: "bad_request", message: "Invalid request." } });
const deny = (code: string) =>
  new RequestError(code === "forbidden" ? 403 : code === "stale_revision" ? 409 : 404, {
    error: {
      code,
      message: code === "stale_revision" ? "Revision is stale." : "Resource unavailable.",
    },
  });
const param = (value: string | string[]) => (Array.isArray(value) ? value[0]! : value);

async function guard(
  services: { auth: AuthService; games: GamesService; memberships: MembershipsService },
  request: Request,
) {
  if (request.method !== "GET") services.auth.requireWriteOrigin(request);
  const actor = await services.auth.requireActor(request);
  const gameId = param(request.params.gameId);
  if (!uuid(gameId)) throw bad();
  const access = await services.games.gameAccess(actor, gameId);
  if (!access) throw deny("not_found");
  return { actor, gameId, access };
}

async function handle<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "forbidden" || code === "not_found" || code === "stale_revision") throw deny(code);
    throw error;
  }
}

export function membershipsController(services: {
  auth: AuthService;
  games: GamesService;
  memberships: MembershipsService;
}) {
  return Controller()
    .prefix("games/:gameId/members")
    .handler((request) => guard(services, request))
    .registerRoutes(
      Route<GameContext>()
        .method("get")
        .path("")
        .handler(async (_request, _response, context) => ({
          members: await services.memberships.listMembers(context.actor, context.gameId),
        })),
      Route<GameContext>()
        .method("put")
        .path(":membershipId/active-character")
        .handler(async (request, _response, context) => {
          if (context.access.role !== "GM") throw deny("forbidden");
          const id = param(request.params.membershipId);
          const body = request.body;
          if (
            !uuid(id) ||
            !body ||
            !Number.isInteger(body.expectedRevision) ||
            body.expectedRevision < 0 ||
            (body.characterId !== null && !uuid(body.characterId))
          )
            throw bad();
          return {
            member: await handle(() =>
              services.memberships.selectPlayerCharacter(
                context.actor,
                context.gameId,
                body.expectedRevision,
                body.characterId,
                id,
              ),
            ),
          };
        }),
      Route<GameContext>()
        .method("post")
        .path(":membershipId/remove")
        .handler(async (request, _response, context) => {
          if (context.access.role !== "GM") throw deny("forbidden");
          const id = param(request.params.membershipId);
          if (!uuid(id)) throw bad();
          return {
            member: await handle(() =>
              services.memberships.setMemberRemoved(context.actor, context.gameId, id, true),
            ),
          };
        }),
      Route<GameContext>()
        .method("post")
        .path(":membershipId/restore")
        .handler(async (request, _response, context) => {
          if (context.access.role !== "GM") throw deny("forbidden");
          const id = param(request.params.membershipId);
          if (!uuid(id)) throw bad();
          return {
            member: await handle(() =>
              services.memberships.setMemberRemoved(context.actor, context.gameId, id, false),
            ),
          };
        }),
    );
}

export function activeSelectionController(services: {
  auth: AuthService;
  games: GamesService;
  memberships: MembershipsService;
}) {
  return Controller()
    .prefix("games/:gameId/active-character")
    .handler((request) => guard(services, request))
    .registerRoutes(
      Route<GameContext>()
        .method("put")
        .path("")
        .handler(async (request, _response, context) => {
          if (context.access.role !== "Player") throw deny("forbidden");
          const body = request.body;
          if (
            !body ||
            !Number.isInteger(body.expectedRevision) ||
            body.expectedRevision < 0 ||
            (body.characterId !== null && !uuid(body.characterId))
          )
            throw bad();
          return {
            member: await handle(() =>
              services.memberships.selectPlayerCharacter(
                context.actor,
                context.gameId,
                body.expectedRevision,
                body.characterId,
              ),
            ),
          };
        }),
    );
}
