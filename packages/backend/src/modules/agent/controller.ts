import { Controller, RequestError, Route } from "arrow-express";
import { badRequest, validationError } from "../../shared/http/errors.ts";
import { routeId } from "../../shared/http/route-id.ts";
import { compileSchema } from "../../shared/validation/parse.ts";
import type { AuthService } from "../auth/types.ts";
import type { GamesService } from "../games/types.ts";
import { requireAgentGm } from "./history.ts";
import { agentTurnInputSchema } from "./schema.ts";
import type { AgentContext, AgentHistory, AgentRuntime } from "./types.ts";

const validateInput = compileSchema(agentTurnInputSchema);
function messageFrom(body: unknown) {
  if (
    typeof body !== "object" ||
    body === null ||
    !("message" in body) ||
    typeof body.message !== "string"
  )
    badRequest("Expected a message.");
  const normalized = { ...body, message: body.message.trim() };
  if (!validateInput(normalized)) {
    if (validateInput.errors?.[0]?.keyword === "additionalProperties") badRequest();
    validationError({ message: "agent_message_length" });
  }
  return normalized.message;
}
function pageFrom(query: Record<string, unknown>) {
  if (query.before !== undefined && typeof query.before !== "string") badRequest("Invalid cursor.");
  const before = typeof query.before === "string" ? routeId(query.before) : null;
  if (query.limit !== undefined && (typeof query.limit !== "string" || !/^\d+$/.test(query.limit)))
    badRequest("Invalid page limit.");
  const limit = Number(query.limit ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) badRequest("Invalid page limit.");
  return { before, limit };
}

const accessErrors: Record<string, number> = {
  agent_game_busy: 409,
  agent_context_changed: 409,
  agent_busy: 429,
  rate_limited: 429,
  agent_failed: 502,
  agent_unavailable: 503,
  agent_timeout: 504,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
};
function translate(error: unknown): never {
  const code = (error as { code?: string })?.code;
  const mapped = code && accessErrors[code];
  if (!mapped) throw error;
  throw new RequestError(mapped, { error: { code } });
}
export function agentController({
  auth,
  games,
  history,
  runtime,
}: {
  auth: AuthService;
  games: GamesService;
  history: AgentHistory;
  runtime: AgentRuntime;
}) {
  return Controller()
    .prefix("games/:gameId/agent")
    .handler(async (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      if (request.method !== "GET") auth.requireWriteOrigin(request);
      const actor = await auth.requireActor(request);
      const gameId = routeId(request.params.gameId);
      try {
        requireAgentGm(await games.gameAccess(actor, gameId));
      } catch (error) {
        translate(error);
      }
      return { actor, gameId };
    })
    .registerRoutes(
      Route<AgentContext>()
        .method("get")
        .path("status")
        .handler(async (request, _response, context) => {
          try {
            const page = await history.page(context, pageFrom(request.query));
            return { available: runtime.available, busy: runtime.busy(context.gameId), ...page };
          } catch (error) {
            translate(error);
          }
        }),
      Route<AgentContext>()
        .method("post")
        .path("turns")
        .handler(async (request, response, context) => {
          const message = messageFrom(request.body);
          const abort = new AbortController();
          const cancel = () => abort.abort();
          response.once("close", cancel);
          const reauthorize = async () => {
            const actor = await auth.requireActor(request);
            if (actor.sessionId !== context.actor.sessionId)
              throw Object.assign(new Error("Session changed."), { code: "unauthorized" });
            requireAgentGm(await games.gameAccess(actor, context.gameId));
          };
          try {
            return await runtime.run(
              {
                ...context,
                requestId: response.locals.requestId,
                reauthorize,
                signal: abort.signal,
              },
              message,
            );
          } catch (error) {
            const retryAfter = (error as { retryAfter?: number })?.retryAfter;
            if (retryAfter) response.setHeader("Retry-After", String(retryAfter));
            translate(error);
          } finally {
            response.off("close", cancel);
          }
        }),
    );
}

export const disabledAgent: AgentRuntime = {
  available: false,
  busy: () => false,
  async run() {
    throw new RequestError(503, {
      error: { code: "agent_disabled" },
    });
  },
};
