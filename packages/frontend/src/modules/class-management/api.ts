import { request as secureRequest } from "../../shared/api";
import { applyCatalogChange } from "./catalog";
import { ContractError, decodeClass, encodeClass } from "./contract";
import type {
  CatalogRequest,
  ClassCatalogApi,
  ClassDefinition,
  RemovalImpact,
  StoredClass,
} from "./types";

const libraryPath = "/api/library/class";
function requestCatalog<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return secureRequest<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((cause) => {
    const failure = cause as Error & {
      status?: number;
      payload?: { error?: { code: string; message: string; impact?: RemovalImpact } };
    };
    if (!failure.status) throw cause;
    const error = failure.payload?.error;
    throw new ContractError(
      failure.status,
      error?.code ?? "request_failed",
      error?.message ?? "Could not confirm the class change.",
      error?.impact,
    );
  });
}

export function createCatalogClient(
  gameId?: string,
  includeLibrary = true,
  request: CatalogRequest = requestCatalog,
  wireId = (id: string) => id,
  viewId = (id: string) => id,
  editGame = false,
): ClassCatalogApi {
  const gameClassesPath = gameId ? `/api/games/${gameId}/classes` : undefined;
  const replace = (
    catalog: Awaited<ReturnType<ClassCatalogApi["load"]>>,
    scope: "library" | "game",
    stored: StoredClass,
  ) => applyCatalogChange(catalog, { kind: "put", scope, entry: decodeClass(stored, viewId) });
  const expectedRevisionFor = (entries: ClassDefinition[], id: string) =>
    entries.find((entry) => entry.id === id)?.revision ?? 0;
  const api: ClassCatalogApi = {
    async load() {
      const [library, game] = await Promise.all([
        includeLibrary ? request<{ templates: StoredClass[] }>(libraryPath) : { templates: [] },
        gameClassesPath ? request<{ classes: StoredClass[] }>(gameClassesPath) : { classes: [] },
      ]);
      return {
        library: library.templates.map((entry) => decodeClass(entry, viewId)),
        game: game.classes.map((entry) => decodeClass(entry, viewId)),
      };
    },
    async save(base, changes) {
      let catalog = base;
      try {
        for (const change of changes) {
          if (change.kind === "copy") {
            if (!gameClassesPath) throw new Error("Open a game before copying a class.");
            const { gameClass } = await request<{ gameClass: StoredClass }>(
              gameClassesPath,
              "POST",
              {
                id: change.id,
                templateId: wireId(change.from),
                expectedTemplateRevision: expectedRevisionFor(catalog.library, change.from),
              },
            );
            catalog = replace(catalog, "game", gameClass);
          } else if (change.scope === "game") {
            if (!api.updateGameClass) throw new Error("Game class editing is unavailable.");
            catalog = await api.updateGameClass(catalog, change.entry);
          } else {
            const { id, systemId, definition } = encodeClass(change.entry, wireId);
            const previous = catalog.library.find((entry) => entry.id === change.entry.id);
            const { template } = previous
              ? await request<{ template: StoredClass }>(`${libraryPath}/${id}`, "PATCH", {
                  expectedRevision: previous.revision ?? 0,
                  definition,
                })
              : await request<{ template: StoredClass }>(libraryPath, "POST", {
                  id,
                  systemId,
                  definition,
                });
            catalog = replace(catalog, "library", template);
          }
        }
      } catch (error) {
        if (catalog === base) throw error;
        throw new ContractError(
          409,
          "partial_save",
          "Some class changes were saved. Reload saved classes.",
        );
      }
      return catalog;
    },
    ...(editGame
      ? {
          async updateGameClass(base, entry, impact) {
            const { id, definition } = encodeClass(entry, wireId);
            const { gameClass } = await request<{ gameClass: StoredClass }>(
              `${gameClassesPath}/${id}`,
              "PATCH",
              {
                expectedRevision: expectedRevisionFor(base.game, entry.id),
                definition,
                confirmedSkillRemovals: impact,
              },
            );
            return replace(base, "game", gameClass);
          },
          async removeGameClass(base, id) {
            await request(`${gameClassesPath}/${wireId(id)}`, "DELETE", {
              expectedRevision: expectedRevisionFor(base.game, id),
            });
            return { ...base, game: base.game.filter((entry) => entry.id !== id) };
          },
        }
      : {}),
    async saveToLibrary(base, id, choice) {
      const target =
        choice.mode === "new"
          ? choice
          : {
              ...choice,
              templateId: wireId(choice.templateId),
              expectedTemplateRevision: expectedRevisionFor(base.library, choice.templateId),
            };
      const { template } = await request<{ template: StoredClass }>(
        `${gameClassesPath}/${wireId(id)}/save-to-library`,
        "POST",
        {
          expectedRevision: expectedRevisionFor(base.game, id),
          target,
        },
      );
      return replace(base, "library", template);
    },
  };

  return api;
}

export const classCatalog = {
  forContext: (gameId?: string, includeLibrary = true) =>
    createCatalogClient(
      gameId,
      includeLibrary,
      undefined,
      undefined,
      undefined,
      Boolean(gameId && includeLibrary),
    ),
};
