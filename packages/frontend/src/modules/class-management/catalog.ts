import type { ClassCatalog, ClassCatalogChange } from "./types";

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
            revision: 0,
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
  }
}
