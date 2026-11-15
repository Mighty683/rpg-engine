import { HttpResponse } from "msw";
import type { ClassDefinition, RemovalImpact } from "../../src/modules/class-management/types";
import {
  completeDefinition,
  decodeClass,
  encodeClass,
  gameClassesPath,
  libraryPath,
  viewId,
  wireId,
} from "../class-management/contract";
import type { Definition, LibraryTarget } from "../class-management/contract";
import { prototypeStore as store } from "./store";

export function classError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) {
  return HttpResponse.json({ error: { code, message, fields } }, { status });
}

const missing = () => classError(404, "not_found", "Class not found.");
const stale = () => classError(409, "stale_revision", "The class changed. Reload saved classes.");

type CatalogInput = {
  id: string;
  systemId?: string;
  templateId: string;
  expectedRevision: number;
  expectedTemplateRevision: number;
  definition: Definition;
  confirmedSkillRemovals?: RemovalImpact;
  target: LibraryTarget;
};

function upsert(list: ClassDefinition[], entry: ClassDefinition) {
  const index = list.findIndex(({ id }) => id === entry.id);
  if (index < 0) list.push(entry);
  else list[index] = entry;
}

function cloneDefinition(entry: ClassDefinition, id: string, name = entry.name): ClassDefinition {
  const copyEffects = (effects: ClassDefinition["benefits"]) =>
    effects.map((effect) => ({ ...effect, id: crypto.randomUUID() }));
  return {
    ...entry,
    id,
    name,
    revision: 0,
    benefits: copyEffects(entry.benefits),
    skills: entry.skills.map((skill) => ({
      ...skill,
      id: crypto.randomUUID(),
      benefits: copyEffects(skill.benefits),
    })),
  };
}

function gameImpact(previous: ClassDefinition, next: ClassDefinition): RemovalImpact {
  return previous.skills
    .filter((skill) => !next.skills.some(({ id }) => id === skill.id))
    .flatMap((skill) => {
      const characters = store.progressionCharacters.flatMap((character) => {
        const rank = store.progressionRanks[character.id]?.[skill.id];
        return rank ? [{ id: wireId(character.id), name: character.name, rank }] : [];
      });
      return characters.length ? [{ skillId: wireId(skill.id), characters }] : [];
    });
}

function impactKey(impact: RemovalImpact) {
  return impact
    .map(({ skillId, characters }) =>
      [skillId, ...characters.map(({ id, rank }) => `${id}:${rank}`).sort()].join("|"),
    )
    .sort()
    .join("/");
}

function updateGame(
  previous: ClassDefinition,
  next: ClassDefinition,
  confirmed: RemovalImpact = [],
) {
  const impact = gameImpact(previous, next);
  if (impactKey(impact) !== impactKey(confirmed))
    return HttpResponse.json(
      {
        error: {
          code: "skill_removal_confirmation_required",
          message: "Review the affected characters and ranks.",
          impact,
        },
      },
      { status: 409 },
    );
  const invalidRank = next.skills.some((skill) =>
    Object.values(store.progressionRanks).some(
      (ranks) => (ranks[skill.id] ?? 0) > Number(skill.maxRank),
    ),
  );
  if (invalidRank)
    return classError(422, "validation", "The new cap is below a learned rank.", {
      skills: "Lower the learned ranks first.",
    });
  for (const character of store.progressionCharacters) {
    if (!store.progressionLevels[character.id]?.[previous.id]) continue;
    for (const removed of impact)
      delete store.progressionRanks[character.id]?.[viewId(removed.skillId)];
    character.revision += 1;
  }
  upsert(store.gameClasses, next);
  return HttpResponse.json({ gameClass: encodeClass(next) });
}

function replyToCreate(
  list: ClassDefinition[],
  key: "template" | "gameClass",
  id: string,
  intent: unknown,
  create: () => ClassDefinition | Response,
) {
  const receipt = `${key}:${id}`;
  const fingerprint = JSON.stringify(intent);
  const previous = store.classCreateReceipts.get(receipt);
  const existing = list.find((entry) => entry.id === id);
  if (previous || existing) {
    if (previous === fingerprint && existing)
      return HttpResponse.json({ [key]: encodeClass(existing) });
    return classError(409, "id_conflict", "The class ID was already used.");
  }
  const result = create();
  if (result instanceof Response) return result;
  list.push(result);
  store.classCreateReceipts.set(receipt, fingerprint);
  return HttpResponse.json({ [key]: encodeClass(result) }, { status: 201 });
}

function incoming(
  definition: Definition,
  id: string,
  revision: number,
): ClassDefinition | Response {
  if (!definition || !Array.isArray(definition.freeBenefits) || !Array.isArray(definition.skills))
    return classError(400, "bad_request", "Supply a class definition.");
  const record = decodeClass({ id: wireId(id), revision, systemId: "fabula-ultima", definition });
  if (!completeDefinition(record))
    return classError(422, "validation", "Complete the class definition.", {
      definition: "Enter valid skills and benefits.",
    });
  return record;
}

function handleLibrary(method: string, id: string, body: CatalogInput) {
  const list = store.libraryClasses;
  if (method === "GET" && !id) return HttpResponse.json({ templates: list.map(encodeClass) });
  if (method === "POST" && !id && body.id) {
    if (body.systemId !== "fabula-ultima")
      return classError(422, "validation", "Choose Fabula Ultima.", {
        systemId: "Unsupported system.",
      });
    return replyToCreate(list, "template", viewId(body.id), body, () =>
      incoming(body.definition, viewId(body.id), 0),
    );
  }
  const entry = list.find((item) => item.id === id);
  if (!entry || method !== "PATCH") return missing();
  if ((entry.revision ?? 0) !== body.expectedRevision) return stale();
  const next = incoming(body.definition, entry.id, (entry.revision ?? 0) + 1);
  if (next instanceof Response) return next;
  upsert(list, next);
  return HttpResponse.json({ template: encodeClass(next) });
}

function copyIntoGame(body: CatalogInput) {
  return replyToCreate(store.gameClasses, "gameClass", viewId(body.id), body, () => {
    const source = store.libraryClasses.find((item) => wireId(item.id) === body.templateId);
    if (!source) return missing();
    if ((source.revision ?? 0) !== body.expectedTemplateRevision) return stale();
    return cloneDefinition(source, viewId(body.id));
  });
}

function saveIntoLibrary(id: string, body: CatalogInput) {
  const entry = store.gameClasses.find((item) => item.id === id);
  const target = body.target;
  if (target?.mode === "new") {
    return replyToCreate(
      store.libraryClasses,
      "template",
      viewId(target.id),
      { sourceId: id, ...body },
      () => {
        if (!entry) return missing();
        if ((entry.revision ?? 0) !== body.expectedRevision) return stale();
        if (!target.name?.trim() || target.name.length > 100)
          return classError(422, "validation", "Enter a template name.", {
            name: "Enter 1–100 characters.",
          });
        return cloneDefinition(entry, viewId(target.id), target.name);
      },
    );
  }
  if (!entry) return missing();
  if (target?.mode !== "update")
    return classError(400, "bad_request", "Choose how to save this class.");
  if ((entry.revision ?? 0) !== body.expectedRevision) return stale();
  const existing = store.libraryClasses.find((item) => wireId(item.id) === target.templateId);
  if (!existing) return missing();
  if ((existing.revision ?? 0) !== target.expectedTemplateRevision) return stale();
  const updated = {
    ...cloneDefinition(entry, existing.id),
    revision: (existing.revision ?? 0) + 1,
  };
  upsert(store.libraryClasses, updated);
  return HttpResponse.json({ template: encodeClass(updated) });
}

function handleGame(method: string, id: string, action: string | undefined, body: CatalogInput) {
  const list = store.gameClasses;
  if (method === "GET" && !id) return HttpResponse.json({ classes: list.map(encodeClass) });
  if (method === "POST" && !id && body.id) return copyIntoGame(body);
  if (method === "POST" && action === "save-to-library") return saveIntoLibrary(id, body);
  const entry = list.find((item) => item.id === id);
  if (!entry || action) return missing();
  if ((entry.revision ?? 0) !== body.expectedRevision) return stale();
  if (method === "PATCH") {
    const next = incoming(body.definition, entry.id, (entry.revision ?? 0) + 1);
    if (next instanceof Response) return next;
    return updateGame(entry, next, body.confirmedSkillRemovals);
  }
  if (method !== "DELETE") return missing();
  if (Object.values(store.progressionLevels).some((levels) => levels[entry.id]))
    return classError(409, "class_in_use", "Remove this class from character sheets first.");
  store.gameClasses = list.filter((item) => item.id !== id);
  return new HttpResponse(null, { status: 204 });
}

export function handleClassCatalog(
  path: string,
  method: string,
  payload: Record<string, unknown>,
  player: boolean,
) {
  const library = path === libraryPath || path.startsWith(`${libraryPath}/`);
  if (player && (library || method !== "GET"))
    return classError(403, "forbidden", "GM access required.");
  const root = library ? libraryPath : gameClassesPath;
  const [rawId = "", action, extra] = path.slice(root.length + 1).split("/");
  if (extra || (library && action)) return missing();
  const id = viewId(rawId);
  const body = payload as unknown as CatalogInput;
  return library ? handleLibrary(method, id, body) : handleGame(method, id, action, body);
}
