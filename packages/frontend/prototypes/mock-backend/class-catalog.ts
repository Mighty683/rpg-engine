import { HttpResponse } from "msw";
import { applyCatalogChange } from "../../src/modules/class-management/catalog";
import type { ClassCatalog, ClassCatalogChange } from "../../src/modules/class-management/types";
import { prototypeStore as store } from "./store";

function snapshot(): ClassCatalog {
  return {
    library: store.libraryClasses,
    game: store.gameClasses,
    characters: store.progressionCharacters.map((character) => ({
      id: character.id,
      name: character.name,
      levels: store.progressionLevels[character.id] ?? {},
      ranks: store.progressionRanks[character.id] ?? {},
    })),
  };
}

function validationError(catalog: ClassCatalog, change: ClassCatalogChange): string | undefined {
  switch (change.kind) {
    case "put": {
      if (!change.entry.name.trim()) return "Enter a class name.";
      if (change.scope === "library") return;
      const previous = catalog.game.find(({ id }) => id === change.entry.id);
      if (!previous) return "Copy the class from the library first.";
      for (const skill of previous.skills) {
        const updated = change.entry.skills.find(({ id }) => id === skill.id);
        const ranks = catalog.characters.map((character) => character.ranks[skill.id] ?? 0);
        const highestRank = Math.max(0, ...ranks);
        if (!highestRank) continue;
        if (!updated) return "Review the affected characters before removing this skill.";
        if ((Math.floor(Number(updated.maxRank)) || 1) < highestRank)
          return "The new rank limit is below an assigned rank.";
      }
      return;
    }
    case "copy":
      if (!catalog.library.some(({ id }) => id === change.from))
        return "That library class is no longer available.";
      return;
    case "remove-class":
      if (catalog.characters.some((character) => character.levels[change.id]))
        return "Remove the class from the affected character sheets first.";
      return;
    case "remove-skill":
      if (
        !catalog.game.some(
          (entry) =>
            entry.id === change.classId &&
            entry.skills.some((skill) => skill.id === change.skillId),
        )
      )
        return "That skill is no longer in this game class.";
      if (
        catalog.characters.some(
          (character) =>
            character.ranks[change.skillId] && !change.confirmedCharacters.includes(character.id),
        )
      )
        return "Skill usage changed. Refresh and review the affected characters.";
      return;
  }
}

export function handleClassCatalog(method: string, body: Record<string, unknown>) {
  const current = snapshot();
  if (method === "GET") return HttpResponse.json(current);
  if (method !== "POST" || !Array.isArray(body.changes))
    return HttpResponse.json({ error: { message: "Invalid catalog update." } }, { status: 400 });
  let next = current;
  for (const change of body.changes as ClassCatalogChange[]) {
    const error = validationError(next, change);
    if (error) return HttpResponse.json({ error: { message: error } }, { status: 400 });
    next = applyCatalogChange(next, change);
  }
  store.libraryClasses = next.library;
  store.gameClasses = next.game;
  for (const character of next.characters) {
    if (character.ranks === current.characters.find(({ id }) => id === character.id)?.ranks)
      continue;
    store.progressionRanks[character.id] = character.ranks;
    const record = store.progressionCharacters.find(({ id }) => id === character.id);
    if (record) record.revision += 1;
  }
  return HttpResponse.json(next);
}
