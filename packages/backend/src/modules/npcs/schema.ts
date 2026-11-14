/** Portable JSON Schema for NPC input shape; semantic checks remain in the contract. */
import type { InputSchema, ObjectInputSchema } from "../../shared/validation/types.ts";
import type { Attribute, Die, NpcAttack, NpcWrite } from "./types.ts";

const attribute: InputSchema<Attribute> = { type: "string", enum: ["DEX", "INS", "MIG", "WLP"] };
const die: InputSchema<Die> = { type: "integer", enum: [6, 8, 10, 12] };
const nonnegativeInteger = { type: "integer", minimum: 0, maximum: 2147483647 } as const;
const name = { type: "string", minLength: 1, maxLength: 100 } as const;
const resource: InputSchema<NpcWrite["hp"]> = {
  type: "object",
  required: ["current", "max"],
  properties: { current: nonnegativeInteger, max: nonnegativeInteger },
  additionalProperties: false,
};

const attack: InputSchema<NpcAttack> = {
  type: "object",
  required: ["id", "name", "reach", "attributes", "damageBonus", "damageType"],
  properties: {
    id: {
      type: "string",
      pattern:
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
    },
    name,
    reach: { type: "string", enum: ["melee", "ranged"] },
    attributes: { type: "array", items: [attribute, attribute], minItems: 2, maxItems: 2 },
    damageBonus: { type: "integer", minimum: -2147483648, maximum: 2147483647 },
    damageType: { type: "string", maxLength: 100 },
  },
  additionalProperties: false,
};

export const npcWriteSchema: InputSchema<NpcWrite> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: [
    "name",
    "relationship",
    "level",
    "visibility",
    "baseDice",
    "hp",
    "mp",
    "defense",
    "magicDefense",
    "attacks",
    "notes",
  ],
  properties: {
    name,
    relationship: { type: "string", enum: ["enemy", "neutral", "friend"] },
    level: { type: "integer", minimum: 5, maximum: 60 },
    visibility: { type: "string", enum: ["hidden", "visible", "known"] },
    baseDice: {
      type: "object",
      required: ["DEX", "INS", "MIG", "WLP"],
      properties: { DEX: die, INS: die, MIG: die, WLP: die },
      additionalProperties: false,
    },
    hp: resource,
    mp: resource,
    defense: nonnegativeInteger,
    magicDefense: nonnegativeInteger,
    attacks: { type: "array", items: attack, maxItems: 100 },
    notes: { type: "string", maxLength: 2000 },
  },
  additionalProperties: false,
};

/** Envelope contents are validated separately to preserve 400 versus 422 precedence. */
export const createNpcEnvelopeSchema: ObjectInputSchema = {
  type: "object",
  required: ["id", "npc"],
  properties: { id: { type: "string" }, npc: {} },
  additionalProperties: false,
};
export const updateNpcEnvelopeSchema: ObjectInputSchema = {
  type: "object",
  required: ["expectedRevision", "npc"],
  properties: { expectedRevision: {}, npc: {} },
  additionalProperties: false,
};
export const removeNpcEnvelopeSchema: ObjectInputSchema = {
  type: "object",
  required: ["expectedRevision"],
  properties: { expectedRevision: {} },
  additionalProperties: false,
};
export const npcRevisionSchema: InputSchema<number> = {
  type: "integer",
  minimum: 0,
  maximum: 2147483647,
};
