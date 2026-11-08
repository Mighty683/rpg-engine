import type { AttributeSetup, WeaponSetup, FreeSetup, CreateThrowInput } from "./types.ts";
import type { Attribute, Die } from "../fabula/types.ts";
// Game Table throw contract: client-supplied setup shapes, strict validation, and the
// persisted/presentation shapes. No endpoint accepts faces, totals, roles, display names
// or a client-supplied weapon bonus; the server resolves all of those.

import { standardDice, freeDice } from "../fabula/rolls.ts";

export const attributes: readonly Attribute[] = ["DEX", "INS", "MIG", "WLP"];
export const gmActorId = "gm";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && uuidRe.test(value);

export const fail = (code: string, message = code, field = "") =>
  Object.assign(new Error(message), { code, field: field ? `/${field.replaceAll(".", "/")}` : "" });

const integer32 = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;

function exactKeys(value: Record<string, unknown>, keys: string[], field: string) {
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw fail("validation", `Unknown ${field} field`, field);
}

function readNote(value: unknown): string {
  if (typeof value !== "string") throw fail("validation", "Invalid note", "note");
  const note = value.trim();
  if (Array.from(note).length > 500) throw fail("validation", "Note must be 500 characters or fewer", "note");
  return note;
}

function readModifier(value: unknown, field: string): number {
  if (!integer32(value)) throw fail("validation", "Modifier must be a 32-bit integer", field);
  return value as number;
}

function readDice(value: unknown, allowed: readonly number[], field: string, min: number, max: number): number[] {
  if (!Array.isArray(value) || value.length < min || value.length > max || value.some((size) => !allowed.includes(size as number)))
    throw fail("validation", `Choose ${min === max ? max : `${min} to ${max}`} valid dice`, field);
  return value as number[];
}

function readAttributes(value: unknown): [Attribute, Attribute?] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2 || value.some((entry) => !attributes.includes(entry as Attribute)))
    throw fail("validation", "Choose one or two attributes", "attributes");
  return value as [Attribute, Attribute?];
}

function parseAttributeSetup(value: Record<string, unknown>): AttributeSetup {
  exactKeys(value, ["type", "characterId", "expectedRevision", "attributes", "dice", "modifier", "redDice", "redModifier", "note"], "setup");
  if (!isUuid(value.characterId)) throw fail("validation", "Invalid character", "characterId");
  if (!Number.isInteger(value.expectedRevision) || (value.expectedRevision as number) < 0)
    throw fail("validation", "Invalid expected revision", "expectedRevision");
  const chosen = readAttributes(value.attributes);
  const dice = value.dice;
  if (!dice || typeof dice !== "object" || Array.isArray(dice)) throw fail("validation", "Invalid dice", "dice");
  const requested = dice as Record<string, unknown>;
  if (Object.keys(requested).some((key) => !attributes.includes(key as Attribute)))
    throw fail("validation", "Unknown attribute die", "dice");
  for (const attribute of chosen) {
    if (!attribute) continue;
    if (requested[attribute] !== undefined && !standardDice.includes(requested[attribute] as Die))
      throw fail("validation", "Attribute dice use d6, d8, d10 or d12", "dice");
  }
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
  exactKeys(value, ["type", "characterId", "equipmentId", "expectedRevision", "dice", "modifier", "note"], "setup");
  if (!isUuid(value.characterId) || !isUuid(value.equipmentId)) throw fail("validation", "Invalid character or weapon", "characterId");
  if (!Number.isInteger(value.expectedRevision) || (value.expectedRevision as number) < 0)
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
  exactKeys(value, ["type", "characterId", "dice", "modifier", "redDice", "redModifier", "note"], "setup");
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

/** Parses and validates a create request body; rejects any authoritative field. */
export function parseCreateRequest(body: unknown): CreateThrowInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw fail("bad_request", "Expected a JSON object");
  const value = body as Record<string, unknown>;
  exactKeys(value, ["sourceThrowId", "setup"], "");
  if (value.sourceThrowId !== null && value.sourceThrowId !== undefined && !isUuid(value.sourceThrowId))
    throw fail("validation", "Invalid source throw", "sourceThrowId");
  const setup = value.setup;
  if (!setup || typeof setup !== "object" || Array.isArray(setup)) throw fail("validation", "Invalid setup", "setup");
  const record = setup as Record<string, unknown>;
  if (record.type === "attribute") return { sourceThrowId: (value.sourceThrowId as string) ?? null, setup: parseAttributeSetup(record) };
  if (record.type === "weapon") return { sourceThrowId: (value.sourceThrowId as string) ?? null, setup: parseWeaponSetup(record) };
  if (record.type === "free") return { sourceThrowId: (value.sourceThrowId as string) ?? null, setup: parseFreeSetup(record) };
  throw fail("validation", "Unknown setup type", "setup.type");
}
