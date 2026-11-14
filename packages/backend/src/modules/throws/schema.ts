import type { InputSchema, ObjectInputSchema } from "../../shared/validation/types.ts";
import {
  uuidSchema,
  revisionSchema,
  int32Schema,
  objectSchema,
} from "../../shared/validation/schema.ts";
import { standardDice, freeDice } from "../fabula/rolls.ts";
import type { Attribute, Die } from "../fabula/types.ts";

export { uuidSchema, revisionSchema, int32Schema, objectSchema };
export const attributeSchema: InputSchema<Attribute> = {
  type: "string",
  enum: ["DEX", "INS", "MIG", "WLP"],
};
export const attributesSchema: InputSchema<Attribute[]> = {
  type: "array",
  minItems: 1,
  maxItems: 2,
  items: attributeSchema,
};
export const noteSchema: InputSchema<string> = { type: "string", maxLength: 500 };
export const stringSchema: InputSchema<string> = { type: "string" };
export const booleanSchema: InputSchema<boolean> = { type: "boolean" };
export const attributeDiceSchema: ObjectInputSchema = {
  type: "object",
  required: [],
  propertyNames: attributeSchema,
  additionalProperties: { type: "integer", enum: standardDice },
};
export const standardDieSchema: InputSchema<Die> = { type: "integer", enum: standardDice };
export function diceSchema(
  allowed: readonly number[],
  min: number,
  max: number,
): InputSchema<number[]> {
  return { type: "array", minItems: min, maxItems: max, items: { type: "integer", enum: allowed } };
}
export const diceSchemas = {
  standardOptional: diceSchema(standardDice, 0, 2),
  standardPair: diceSchema(standardDice, 2, 2),
  freeRequired: diceSchema(freeDice, 1, 2),
  freeOptional: diceSchema(freeDice, 0, 2),
};
export const setupKeys = {
  attribute: [
    "type",
    "characterId",
    "expectedRevision",
    "attributes",
    "dice",
    "modifier",
    "redDice",
    "redModifier",
    "note",
  ],
  weapon: ["type", "characterId", "equipmentId", "expectedRevision", "dice", "modifier", "note"],
  free: ["type", "characterId", "dice", "modifier", "redDice", "redModifier", "note"],
  npcAttribute: [
    "type",
    "npcId",
    "expectedRevision",
    "attributes",
    "dice",
    "modifier",
    "redDice",
    "redModifier",
    "note",
  ],
  npcAttack: ["type", "npcId", "attackId", "expectedRevision", "dice", "modifier", "note"],
  request: ["sourceThrowId", "setup", "private"],
} as const;
/** Separate key checks retain legacy failure precedence before individual field checks. */
export function keysSchema(keys: readonly string[]): ObjectInputSchema {
  return {
    type: "object",
    properties: Object.fromEntries(keys.map((key) => [key, {}])),
    additionalProperties: false,
  };
}
