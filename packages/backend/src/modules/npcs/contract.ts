/** Normalize NPC input without mutation, then validate structure and cross-field rules. */
import {
  compileSchema,
  compileObjectSchema,
  invalidValue,
  parseSchema,
} from "../../shared/validation/parse.ts";
import {
  npcWriteSchema,
  createNpcEnvelopeSchema,
  updateNpcEnvelopeSchema,
  removeNpcEnvelopeSchema,
  npcRevisionSchema,
} from "./schema.ts";
import { parseEnvelope } from "../../shared/http/validation.ts";
import type { NpcWrite } from "./types.ts";

const validateNpc = compileSchema(npcWriteSchema);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeAttack(value: unknown): unknown {
  if (!isObject(value)) return value;
  return {
    ...value,
    name: typeof value.name === "string" ? value.name.trim() : value.name,
    id: typeof value.id === "string" ? value.id.toLowerCase() : value.id,
  };
}

function normalizeProfile(value: unknown): unknown {
  if (!isObject(value)) return value;
  return {
    ...value,
    name: typeof value.name === "string" ? value.name.trim() : value.name,
    attacks: Array.isArray(value.attacks) ? value.attacks.map(normalizeAttack) : value.attacks,
  };
}

/** Validate and normalize the complete replacement profile at the API boundary. */
export function parseNpcWrite(value: unknown): NpcWrite {
  const profile = parseSchema(validateNpc, normalizeProfile(value), "npc");
  if (profile.hp.current > profile.hp.max) invalidValue("hp.current");
  if (profile.mp.current > profile.mp.max) invalidValue("mp.current");
  if (new Set(profile.attacks.map((attack) => attack.id)).size !== profile.attacks.length)
    invalidValue("attacks");
  return profile;
}

const validateCreateEnvelope = compileObjectSchema(createNpcEnvelopeSchema);
const validateUpdateEnvelope = compileObjectSchema(updateNpcEnvelopeSchema);
const validateRemoveEnvelope = compileObjectSchema(removeNpcEnvelopeSchema);
const validateRevision = compileSchema(npcRevisionSchema);
export const parseNpcCreateEnvelope = (value: unknown) =>
  parseEnvelope(validateCreateEnvelope, value);
export const parseNpcUpdateEnvelope = (value: unknown) =>
  parseEnvelope(validateUpdateEnvelope, value);
export const parseNpcRemoveEnvelope = (value: unknown) =>
  parseEnvelope(validateRemoveEnvelope, value);
export const parseNpcRevision = (value: unknown) => parseEnvelope(validateRevision, value);
