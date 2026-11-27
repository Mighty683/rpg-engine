import { parseEnvelope, parseFields } from "../../shared/http/validation.ts";
import { validationError } from "../../shared/http/errors.ts";
import { compileObjectSchema } from "../../shared/validation/parse.ts";
import {
  copyClassSchema,
  createTemplateSchema,
  deleteGameClassSchema,
  updateGameClassSchema,
  saveClassToLibrarySchema,
  updateTemplateSchema,
} from "./schema.ts";
import type {
  ClassBenefit,
  ClassDefinition,
  CopyClass,
  CreateTemplate,
  DeleteGameClass,
  UpdateGameClass,
  SaveClassToLibrary,
  UpdateTemplate,
} from "./types.ts";

const create = compileObjectSchema(createTemplateSchema);
const update = compileObjectSchema(updateTemplateSchema);
const copy = compileObjectSchema(copyClassSchema);
const updateGame = compileObjectSchema(updateGameClassSchema);
const deleteGame = compileObjectSchema(deleteGameClassSchema);
const save = compileObjectSchema(saveClassToLibrarySchema);

function text(value: string) {
  if (value.includes("\0") || !value.isWellFormed())
    validationError({ definition: "use_valid_text_without_null_characters" });
  return value;
}

function name(value: string) {
  const trimmed = text(value).trim();
  if (!trimmed) validationError({ name: "enter_a_name" });
  return trimmed;
}

function cleanDefinition(definition: ClassDefinition): ClassDefinition {
  const used = new Set<string>();
  function unique(id: string) {
    const key = id.toLowerCase();
    if (used.has(key)) validationError({ definition: "use_distinct_skill_and_benefit_ids" });
    used.add(key);
    return key;
  }
  function benefit(item: ClassBenefit, free = false): ClassBenefit {
    if (item.kind === "text" && !item.description.trim())
      validationError({ definition: "enter_a_description_for_each_text_benefit" });
    const identity = { id: unique(item.id), name: name(item.name) };
    if (item.kind === "text") return { ...item, ...identity, description: text(item.description) };
    const { perRank, ...modifier } = item;
    return {
      ...modifier,
      ...identity,
      ...(modifier.description !== undefined ? { description: text(modifier.description) } : {}),
      ...(!free && perRank ? { perRank: true } : {}),
    };
  }
  return {
    name: name(definition.name),
    description: text(definition.description),
    freeBenefits: definition.freeBenefits.map((item) => benefit(item, true)),
    skills: definition.skills.map((item) => ({
      ...item,
      id: unique(item.id),
      name: name(item.name),
      description: text(item.description),
      benefits: item.benefits.map((effect) => benefit(effect)),
    })),
  };
}

export function parseCreateTemplate(value: unknown): CreateTemplate {
  const input = parseFields(create, value, "template") as CreateTemplate;
  return { ...input, id: input.id.toLowerCase(), definition: cleanDefinition(input.definition) };
}
export function parseUpdateTemplate(value: unknown): UpdateTemplate {
  const input = parseFields(update, value, "template") as UpdateTemplate;
  return { ...input, definition: cleanDefinition(input.definition) };
}
export function parseCopyClass(value: unknown): CopyClass {
  const input = parseEnvelope(copy, value) as CopyClass;
  return { ...input, id: input.id.toLowerCase(), templateId: input.templateId.toLowerCase() };
}
export function parseSaveClassToLibrary(value: unknown): SaveClassToLibrary {
  const input = parseFields(save, value, "target") as SaveClassToLibrary;
  const target = input.target;
  return {
    ...input,
    target:
      target.mode === "new"
        ? { ...target, id: target.id.toLowerCase(), name: name(target.name) }
        : { ...target, templateId: target.templateId.toLowerCase() },
  };
}

export function parseUpdateGameClass(value: unknown): UpdateGameClass {
  const input = parseFields(updateGame, value, "gameClass") as UpdateGameClass;
  return {
    ...input,
    definition: cleanDefinition(input.definition),
    confirmedSkillRemovals: input.confirmedSkillRemovals?.map(({ skillId, characters }) => ({
      skillId: skillId.toLowerCase(),
      characters: characters.map((character) => ({ ...character, id: character.id.toLowerCase() })),
    })),
  };
}

export function parseDeleteGameClass(value: unknown): DeleteGameClass {
  return parseEnvelope(deleteGame, value) as DeleteGameClass;
}
