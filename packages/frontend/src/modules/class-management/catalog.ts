import type { InjectionKey } from "vue";
import type { ClassCatalog, ClassCatalogApi, ClassCatalogChange } from "./types";

export const classCatalogApiKey: InjectionKey<ClassCatalogApi> = Symbol("class catalog");

export function applyCatalogChange(
  catalog: ClassCatalog,
  change: ClassCatalogChange,
): ClassCatalog {
  switch (change.kind) {
    case "put": {
      const list = catalog[change.scope];
      return {
        ...catalog,
        [change.scope]: list.some(({ id }) => id === change.entry.id)
          ? list.map((entry) => (entry.id === change.entry.id ? change.entry : entry))
          : [...list, change.entry],
      };
    }
    case "copy": {
      const source = catalog.library.find(({ id }) => id === change.from);
      if (!source) return catalog;
      return {
        ...catalog,
        game: [
          ...catalog.game,
          {
            ...source,
            id: change.id,
            benefits: source.benefits.map((benefit) => ({ ...benefit })),
            skills: source.skills.map((skill) => ({
              ...skill,
              id: `${change.id}-${skill.id}`,
              benefits: skill.benefits.map((benefit) => ({ ...benefit })),
            })),
          },
        ],
      };
    }
    case "remove-class":
      return { ...catalog, game: catalog.game.filter(({ id }) => id !== change.id) };
    case "remove-skill":
      return {
        ...catalog,
        game: catalog.game.map((entry) =>
          entry.id === change.classId
            ? { ...entry, skills: entry.skills.filter(({ id }) => id !== change.skillId) }
            : entry,
        ),
        characters: catalog.characters.map((character) => {
          if (!(change.skillId in character.ranks)) return character;
          const ranks = { ...character.ranks };
          delete ranks[change.skillId];
          return { ...character, ranks };
        }),
      };
  }
}
