import type { AttributeSetup, WeaponSetup, FreeSetup, CreateThrowInput } from "./types.ts";
import type { Attribute, Die } from "../fabula/types.ts";
// Game Table throw contract: client-supplied setup shapes, strict validation, and the
// persisted/presentation shapes. No endpoint accepts faces, totals, roles, display names
// or a client-supplied weapon bonus; the server resolves all of those.

import { standardDice, freeDice } from "../fabula/rolls.ts";
import { compileSchema, compileObjectSchema } from "../../shared/validation/parse.ts";
import {
  uuidSchema,
  revisionSchema,
  int32Schema,
  objectSchema,
  stringSchema,
  noteSchema,
  attributesSchema,
  attributeDiceSchema,
  standardDieSchema,
  booleanSchema,
  diceSchemas,
  setupKeys,
  keysSchema,
} from "./schema.ts";
import type { ThrowListQuery } from "./types.ts";

export const attributes: readonly Attribute[] = ["DEX", "INS", "MIG", "WLP"];
export const gmActorId = "gm";

const validateUuid = compileSchema(uuidSchema);
const validateRevision = compileSchema(revisionSchema);
const validateInteger = compileSchema(int32Schema);
const validateObject = compileSchema(objectSchema);
const validateString = compileSchema(stringSchema);
const validateNote = compileSchema(noteSchema);
const validateAttributes = compileSchema(attributesSchema);
const validateAttributeDice = compileObjectSchema(attributeDiceSchema);
const validateStandardDie = compileSchema(standardDieSchema);
const validateBoolean = compileSchema(booleanSchema);
const validateDice = {
  standardOptional: compileSchema(diceSchemas.standardOptional),
  standardPair: compileSchema(diceSchemas.standardPair),
  freeRequired: compileSchema(diceSchemas.freeRequired),
  freeOptional: compileSchema(diceSchemas.freeOptional),
};
const validateKeys = new Map(
  Object.values(setupKeys).map((keys) => [keys.join(","), compileObjectSchema(keysSchema(keys))]),
);
export const isUuid = (value: unknown): value is string => validateUuid(value);

export const fail = (code: string, message = code, field = "") =>
  Object.assign(new Error(message), { code, field: field ? `/${field.replaceAll(".", "/")}` : "" });

function exactKeys(value: Record<string, unknown>, keys: readonly string[], field: string) {
  const validate = validateKeys.get(keys.join(","));
  if (!validate) throw new Error("Unregistered throw key schema");
  if (!validate(value)) throw fail("validation", `Unknown ${field} field`, field);
}

function readNote(value: unknown): string {
  if (!validateString(value)) throw fail("validation", "Invalid note", "note");
  const note = value.trim();
  if (!validateNote(note)) throw fail("validation", "Note must be 500 characters or fewer", "note");
  return note;
}

function readModifier(value: unknown, field: string): number {
  if (!validateInteger(value)) throw fail("validation", "Modifier must be a 32-bit integer", field);
  return value as number;
}

function readDice(
  value: unknown,
  allowed: readonly number[],
  field: string,
  min: number,
  max: number,
): number[] {
  const validator =
    allowed === standardDice
      ? min === 0
        ? validateDice.standardOptional
        : validateDice.standardPair
      : min === 0
        ? validateDice.freeOptional
        : validateDice.freeRequired;
  if (!validator(value))
    throw fail("validation", `Choose ${min === max ? max : `${min} to ${max}`} valid dice`, field);
  return value as number[];
}

function readAttributes(value: unknown): [Attribute, Attribute?] {
  if (!validateAttributes(value))
    throw fail("validation", "Choose one or two attributes", "attributes");
  return value as [Attribute, Attribute?];
}

function parseAttributeSetup(value: Record<string, unknown>): AttributeSetup {
  exactKeys(value, setupKeys.attribute, "setup");
  if (!isUuid(value.characterId)) throw fail("validation", "Invalid character", "characterId");
  if (!validateRevision(value.expectedRevision))
    throw fail("validation", "Invalid expected revision", "expectedRevision");
  const chosen = readAttributes(value.attributes);
  const dice = value.dice;
  if (!validateObject(dice)) throw fail("validation", "Invalid dice", "dice");
  const requested = dice as Record<string, unknown>;
  if (
    !validateAttributeDice(requested) &&
    validateAttributeDice.errors?.some((error) => error.keyword === "propertyNames")
  )
    throw fail("validation", "Unknown attribute die", "dice");
  if (Object.values(requested).some((die) => !validateStandardDie(die)))
    throw fail("validation", "Attribute dice use d6, d8, d10 or d12", "dice");
  return {
    type: "attribute",
    characterId: value.characterId,
    expectedRevision: value.expectedRevision as number,
    attributes: chosen,
    dice: requested as Partial<Record<Attribute, Die>>,
    modifier: readModifier(value.modifier, "modifier"),
    redDice: readDice(value.redDice, standardDice, "redDice", 0, 2) as Die[],
    redModifier: readModifier(value.redModifier, "redModifier"),
    note: readNote(value.note),
  };
}

function parseWeaponSetup(value: Record<string, unknown>): WeaponSetup {
  exactKeys(value, setupKeys.weapon, "setup");
  if (!isUuid(value.characterId) || !isUuid(value.equipmentId))
    throw fail("validation", "Invalid character or weapon", "characterId");
  if (!validateRevision(value.expectedRevision))
    throw fail("validation", "Invalid expected revision", "expectedRevision");
  return {
    type: "weapon",
    characterId: value.characterId,
    equipmentId: value.equipmentId,
    expectedRevision: value.expectedRevision as number,
    dice: readDice(value.dice, standardDice, "dice", 2, 2) as [Die, Die],
    modifier: readModifier(value.modifier, "modifier"),
    note: readNote(value.note),
  };
}

function parseFreeSetup(value: Record<string, unknown>): FreeSetup {
  exactKeys(value, setupKeys.free, "setup");
  if (value.characterId !== gmActorId && !isUuid(value.characterId))
    throw fail("validation", "Invalid roll attribution", "characterId");
  const dice = readDice(value.dice, freeDice, "dice", 1, 2);
  const redDice = readDice(value.redDice, freeDice, "redDice", 0, 2);
  return {
    type: "free",
    characterId: value.characterId,
    dice,
    modifier: readModifier(value.modifier, "modifier"),
    redDice,
    redModifier: readModifier(value.redModifier, "redModifier"),
    note: readNote(value.note),
  };
}

function parseNpcAttribute(record: Record<string, unknown>) {
  exactKeys(record, setupKeys.npcAttribute, "setup");
  const { npcId, ...rest } = record;
  if (!isUuid(npcId)) throw fail("validation", "Invalid NPC", "npcId");
  const parsed = parseAttributeSetup({ ...rest, type: "attribute", characterId: npcId });
  const { characterId: _characterId, ...setup } = parsed;
  return { ...setup, type: "npc-attribute" as const, npcId };
}

function parseNpcAttack(record: Record<string, unknown>) {
  exactKeys(record, setupKeys.npcAttack, "setup");
  const { npcId, attackId, ...rest } = record;
  if (!isUuid(npcId) || !isUuid(attackId))
    throw fail("validation", "Invalid NPC or attack", "npcId");
  const parsed = parseWeaponSetup({
    ...rest,
    type: "weapon",
    characterId: npcId,
    equipmentId: attackId,
  });
  const { characterId: _characterId, equipmentId: _equipmentId, ...setup } = parsed;
  return { ...setup, type: "npc-attack" as const, npcId, attackId };
}

/** Parses and validates a create request body; rejects any authoritative field. */
export function parseCreateRequest(body: unknown): CreateThrowInput {
  if (!validateObject(body)) throw fail("bad_request", "Expected a JSON object");
  const value = body as Record<string, unknown>;
  exactKeys(value, setupKeys.request, "");
  if (value.private !== undefined && !validateBoolean(value.private))
    throw fail("validation", "Invalid privacy setting", "private");
  if (
    value.sourceThrowId !== null &&
    value.sourceThrowId !== undefined &&
    !isUuid(value.sourceThrowId)
  )
    throw fail("validation", "Invalid source throw", "sourceThrowId");
  const setup = value.setup;
  if (!validateObject(setup)) throw fail("validation", "Invalid setup", "setup");
  const record = setup as Record<string, unknown>;
  if (record.type === "npc-attribute")
    return {
      private: value.private === true,
      sourceThrowId: (value.sourceThrowId as string) ?? null,
      setup: parseNpcAttribute(record),
    };
  if (record.type === "npc-attack")
    return {
      private: value.private === true,
      sourceThrowId: (value.sourceThrowId as string) ?? null,
      setup: parseNpcAttack(record),
    };
  if (record.type === "attribute")
    return {
      private: value.private === true,
      sourceThrowId: (value.sourceThrowId as string) ?? null,
      setup: parseAttributeSetup(record),
    };
  if (record.type === "weapon")
    return {
      private: value.private === true,
      sourceThrowId: (value.sourceThrowId as string) ?? null,
      setup: parseWeaponSetup(record),
    };
  if (record.type === "free")
    return {
      private: value.private === true,
      sourceThrowId: (value.sourceThrowId as string) ?? null,
      setup: parseFreeSetup(record),
    };
  throw fail("validation", "Unknown setup type", "setup.type");
}

/** Query normalization is intentionally permissive and independent of body coercion. */
export function parseThrowListQuery(query: Record<string, unknown>): ThrowListQuery {
  const before =
    query.before === undefined || query.before === null || query.before === ""
      ? null
      : query.before;
  if (before !== null && !isUuid(before)) throw fail("bad_request", "Invalid cursor.");
  const limit =
    typeof query.limit === "string" && /^\d+$/.test(query.limit) ? Number(query.limit) : 20;
  return { before, limit: Math.min(Math.max(limit, 1), 100) };
}
