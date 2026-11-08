import { Controller, RequestError, Route } from "arrow-express";
import type { Request } from "express";
import type { Services } from "../../services.ts";
import { requireWriteOrigin, type Actor } from "../auth/guards.ts";

const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const bad = () => new RequestError(400, { error: { code: "bad_request", message: "Invalid request." } });
const deny = (code: string) => new RequestError(code === "forbidden" ? 403 : code === "conflict" ? 409 : 404, { error: { code, message: "Invitation unavailable." } });
const param = (value: string | string[]) => Array.isArray(value) ? value[0]! : value;

async function manageGuard(services: Pick<Services, "auth" | "games" | "invitations">, request: Request) {
  if (request.method !== "GET") requireWriteOrigin(request);
  const actor = await services.auth.requireActor(request);
  const gameId = param(request.params.gameId);
  if (!uuid(gameId)) throw bad();
  const access = await services.games.gameAccess(actor, gameId);
  if (!access) throw deny("not_found");
  if (access.role !== "GM") throw deny("forbidden");
  return { actor, gameId };
}

type GameInvitationContext = Awaited<ReturnType<typeof manageGuard>>;
type InvitationContext = { actor: Actor; token: string };

async function handle<T>(operation: () => Promise<T>) {
  try { return await operation(); }
  catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "forbidden" || code === "not_found" || code === "conflict") throw deny(code);
    throw error;
  }
}

export function gameInvitationsController(services: Pick<Services, "auth" | "games" | "invitations">) {
  return Controller().prefix("games/:gameId/invitations").handler((request) => manageGuard(services, request)).registerRoutes(
    Route<GameInvitationContext>().method("get").path("").handler(async (_request, _response, context) => ({ invitations: await services.invitations.listInvitations(context.actor, context.gameId) })),
    Route<GameInvitationContext>().method("post").path("").handler(async (request, _response, context) => {
      const body = request.body;
      if (!body || body.kind === "game") return { invitation: await handle(() => services.invitations.ensureGameInvitation(context.actor, context.gameId)) };
      if (body.kind !== "character" || !uuid(body.characterId)) throw bad();
      return { invitation: await handle(() => services.invitations.createCharacterInvitation(context.actor, context.gameId, body.characterId)) };
    }),
    Route<GameInvitationContext>().method("patch").path(":invitationId").handler(async (request, _response, context) => {
      const id = param(request.params.invitationId);
      if (!uuid(id) || typeof request.body?.enabled !== "boolean") throw bad();
      return { invitation: await handle(() => services.invitations.updateInvitation(context.actor, context.gameId, id, { enabled: request.body.enabled })) };
    }),
    Route<GameInvitationContext>().method("post").path(":invitationId/rotate").handler(async (request, _response, context) => {
      const id = param(request.params.invitationId);
      if (!uuid(id)) throw bad();
      return { invitation: await handle(() => services.invitations.updateInvitation(context.actor, context.gameId, id, { rotate: true })) };
    }),
  );
}

export function invitationController(services: Pick<Services, "auth" | "games" | "invitations">) {
  return Controller().prefix("invitations/:token").handler(async (request) => {
    if (request.method !== "GET") requireWriteOrigin(request);
    return { actor: await services.auth.requireActor(request), token: param(request.params.token) };
  }).registerRoutes(
    Route<InvitationContext>().method("get").path("").handler(async (_request, response, context) => {
      response.setHeader("Referrer-Policy", "no-referrer");
      return { invitation: await handle(() => services.invitations.previewInvitation(context.actor, context.token)) };
    }),
    Route<InvitationContext>().method("post").path("accept").handler(async (request, _response, context) => {
      const makeActive = request.body?.makeActive ?? true;
      if (typeof makeActive !== "boolean") throw bad();
      return handle(() => services.invitations.acceptInvitation(context.actor, context.token, makeActive));
    }),
  );
}
