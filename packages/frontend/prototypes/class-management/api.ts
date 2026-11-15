import { applyCatalogChange } from "../../src/modules/class-management/catalog";
import type { ClassCatalogApi, ClassDefinition } from "../../src/modules/class-management/types";
import {
  contractRequest,
  ContractError,
  decodeClass,
  encodeClass,
  gameClassesPath,
  libraryPath,
  wireId,
} from "./contract";
import type { StoredClass } from "./contract";

const request = <T>(path: string, method = "GET", body?: unknown) =>
  contractRequest<T>(path, { method, body });
const replace = (
  catalog: Awaited<ReturnType<ClassCatalogApi["load"]>>,
  scope: "library" | "game",
  stored: StoredClass,
) => applyCatalogChange(catalog, { kind: "put", scope, entry: decodeClass(stored) });
const expectedRevisionFor = (entries: ClassDefinition[], id: string) =>
  entries.find((entry) => entry.id === id)?.revision ?? 0;
export const classCatalogApi: ClassCatalogApi = {
  async load() {
    const [library, game] = await Promise.all([
      request<{ templates: StoredClass[] }>(libraryPath),
      request<{ classes: StoredClass[] }>(gameClassesPath),
    ]);
    return { library: library.templates.map(decodeClass), game: game.classes.map(decodeClass) };
  },
  async save(base, changes) {
    let catalog = base;
    try {
      for (const change of changes) {
        if (change.kind === "copy") {
          const { gameClass } = await request<{ gameClass: StoredClass }>(gameClassesPath, "POST", {
            id: change.id,
            templateId: wireId(change.from),
            expectedTemplateRevision: expectedRevisionFor(catalog.library, change.from),
          });
          catalog = replace(catalog, "game", gameClass);
        } else if (change.scope === "game") {
          catalog = await classCatalogApi.updateGameClass(catalog, change.entry);
        } else {
          const { id, systemId, definition } = encodeClass(change.entry);
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
  async updateGameClass(base, entry, impact) {
    const { id, definition } = encodeClass(entry);
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
