import type { GameInvitationContext, InvitationContext, InvitationsService } from "./types.ts";
import type { AuthService } from "../auth/types.ts";
import type { GamesService } from "../games/types.ts";
import { Controller, RequestError, Route } from "arrow-express";
import type { Request } from "express";

import {
  parseInvitationId,
  parseCreateInvitation,
  parseUpdateInvitation,
  parseAcceptInvitation,
} from "./contract.ts";
const deny = (code: string) =>
  new RequestError(code === "forbidden" ? 403 : code === "conflict" ? 409 : 404, {
    error: { code, message: "Invitation unavailable." },
  });
const param = (value: string | string[]) => (Array.isArray(value) ? value[0]! : value);

async function manageGuard(
  services: { auth: AuthService; games: GamesService; invitations: InvitationsService },
  request: Request,
) {
  if (request.method !== "GET") services.auth.requireWriteOrigin(request);
  const actor = await services.auth.requireActor(request);
  const gameId = parseInvitationId(param(request.params.gameId));
  const access = await services.games.gameAccess(actor, gameId);
  if (!access) throw deny("not_found");
  if (access.role !== "GM") throw deny("forbidden");
  return { actor, gameId };
}

async function handle<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "forbidden" || code === "not_found" || code === "conflict") throw deny(code);
    throw error;
  }
}

export function gameInvitationsController(services: {
  auth: AuthService;
  games: GamesService;
  invitations: InvitationsService;
}) {
  return Controller()
    .prefix("games/:gameId/invitations")
    .handler((request) => manageGuard(services, request))
    .registerRoutes(
      Route<GameInvitationContext>()
        .method("get")
        .path("")
        .handler(async (_request, _response, context) => ({
          invitations: await services.invitations.listInvitations(context.actor, context.gameId),
        })),
      Route<GameInvitationContext>()
        .method("post")
        .path("")
        .handler(async (request, _response, context) => {
          const body = parseCreateInvitation(request.body);
          if (body.kind === "game")
            return {
              invitation: await handle(() =>
                services.invitations.ensureGameInvitation(context.actor, context.gameId),
              ),
            };
          return {
            invitation: await handle(() =>
              services.invitations.createCharacterInvitation(
                context.actor,
                context.gameId,
                body.characterId,
              ),
            ),
          };
        }),
      Route<GameInvitationContext>()
        .method("patch")
        .path(":invitationId")
        .handler(async (request, _response, context) => {
          const id = parseInvitationId(param(request.params.invitationId));
          const body = parseUpdateInvitation(request.body);
          return {
            invitation: await handle(() =>
              services.invitations.updateInvitation(context.actor, context.gameId, id, {
                enabled: body.enabled,
              }),
            ),
          };
        }),
      Route<GameInvitationContext>()
        .method("post")
        .path(":invitationId/rotate")
        .handler(async (request, _response, context) => {
          const id = parseInvitationId(param(request.params.invitationId));
          return {
            invitation: await handle(() =>
              services.invitations.updateInvitation(context.actor, context.gameId, id, {
                rotate: true,
              }),
            ),
          };
        }),
    );
}

export function invitationController(services: {
  auth: AuthService;
  invitations: InvitationsService;
}) {
  return Controller()
    .prefix("invitations/:token")
    .handler(async (request) => {
      if (request.method !== "GET") services.auth.requireWriteOrigin(request);
      return {
        actor: await services.auth.requireActor(request),
        token: param(request.params.token),
      };
    })
    .registerRoutes(
      Route<InvitationContext>()
        .method("get")
        .path("")
        .handler(async (_request, response, context) => {
          response.setHeader("Referrer-Policy", "no-referrer");
          return {
            invitation: await handle(() =>
              services.invitations.previewInvitation(context.actor, context.token),
            ),
          };
        }),
      Route<InvitationContext>()
        .method("post")
        .path("accept")
        .handler(async (request, _response, context) => {
          const { makeActive } = parseAcceptInvitation(request.body);
          return handle(() =>
            services.invitations.acceptInvitation(context.actor, context.token, makeActive),
          );
        }),
    );
}
