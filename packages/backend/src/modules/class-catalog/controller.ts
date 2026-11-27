import { Controller, RequestError, Route } from "arrow-express";
import type { AuthService } from "../auth/types.ts";
import type { GameActor } from "../games/types.ts";
import { routeId } from "../../shared/http/route-id.ts";
import {
  parseCopyClass,
  parseCreateTemplate,
  parseDeleteGameClass,
  parseUpdateGameClass,
  parseSaveClassToLibrary,
  parseUpdateTemplate,
} from "./contract.ts";
import { validationError } from "../../shared/http/errors.ts";
import type { ClassCatalogService, GameClassEdits, SkillRemovalImpact } from "./types.ts";

type GameContext = { actor: GameActor; gameId: string };

function requestError(error: unknown): never {
  const code = (error as { code?: string }).code;
  if (code === "not_found") throw new RequestError(404, { error: { code } });
  if (code === "forbidden")
    throw new RequestError(403, {
      error: { code },
    });
  if (code === "stale_revision")
    throw new RequestError(409, {
      error: { code },
    });
  if (code === "id_conflict")
    throw new RequestError(409, {
      error: { code },
    });
  if (code === "class_in_use")
    throw new RequestError(409, {
      error: { code },
    });
  if (code === "skill_removal_confirmation_required")
    throw new RequestError(409, {
      error: {
        code,
        impact: (error as { impact: SkillRemovalImpact[] }).impact,
      },
    });
  if (code === "skill_rank_in_use") validationError({ definition: "skill_rank_in_use" });
  if (code === "skill_id_unavailable") validationError({ definition: "skill_id_unavailable" });
  throw error;
}

export function classLibraryController(auth: AuthService, catalog: ClassCatalogService) {
  return Controller()
    .prefix("library/class")
    .handler(async (request) => {
      if (request.method !== "GET") auth.requireWriteOrigin(request);
      return auth.requireActor(request);
    })
    .registerRoutes(
      Route<GameActor>()
        .method("get")
        .path("")
        .handler(async (_request, _response, actor) => ({
          templates: await catalog.listTemplates(actor),
        })),
      Route<GameActor>()
        .method("post")
        .path("")
        .handler(async (request, response, actor) => {
          const result = await catalog
            .createTemplate(actor, parseCreateTemplate(request.body))
            .catch(requestError);
          response.status(result.created ? 201 : 200);
          return { template: result.record };
        }),
      Route<GameActor>()
        .method("patch")
        .path(":templateId")
        .handler(async (request, _response, actor) => ({
          template: await catalog
            .updateTemplate(
              actor,
              routeId(request.params.templateId),
              parseUpdateTemplate(request.body),
            )
            .catch(requestError),
        })),
    );
}

export function gameClassesController(
  auth: AuthService,
  catalog: ClassCatalogService,
  edits: GameClassEdits,
) {
  return Controller()
    .prefix("games/:gameId/classes")
    .handler(async (request) => {
      if (request.method !== "GET") auth.requireWriteOrigin(request);
      return {
        actor: await auth.requireActor(request),
        gameId: routeId(request.params.gameId).toLowerCase(),
      };
    })
    .registerRoutes(
      Route<GameContext>()
        .method("get")
        .path("")
        .handler(async (_request, _response, { actor, gameId }) => ({
          classes: await catalog.listGameClasses(actor, gameId).catch(requestError),
        })),
      Route<GameContext>()
        .method("post")
        .path("")
        .handler(async (request, response, { actor, gameId }) => {
          const result = await catalog
            .copyClass(actor, gameId, parseCopyClass(request.body))
            .catch(requestError);
          response.status(result.created ? 201 : 200);
          return { gameClass: result.record };
        }),
      Route<GameContext>()
        .method("patch")
        .path(":gameClassId")
        .handler(async (request, _response, { actor, gameId }) => ({
          gameClass: await edits
            .updateGameClass(
              actor,
              gameId,
              routeId(request.params.gameClassId).toLowerCase(),
              parseUpdateGameClass(request.body),
            )
            .catch(requestError),
        })),
      Route<GameContext>()
        .method("delete")
        .path(":gameClassId")
        .handler(async (request, response, { actor, gameId }) => {
          await edits
            .removeGameClass(
              actor,
              gameId,
              routeId(request.params.gameClassId).toLowerCase(),
              parseDeleteGameClass(request.body),
            )
            .catch(requestError);
          response.status(204).end();
        }),
      Route<GameContext>()
        .method("post")
        .path(":gameClassId/save-to-library")
        .handler(async (request, response, { actor, gameId }) => {
          const result = await catalog
            .saveToLibrary(
              actor,
              gameId,
              routeId(request.params.gameClassId).toLowerCase(),
              parseSaveClassToLibrary(request.body),
            )
            .catch(requestError);
          response.status(result.created ? 201 : 200);
          return { template: result.record };
        }),
    );
}
