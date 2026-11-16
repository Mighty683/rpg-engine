import type { InputSchema, ObjectInputSchema } from "../../shared/validation/types.ts";
import { uuidSchema, revisionSchema } from "../../shared/validation/schema.ts";

export const createCharacterEnvelopeSchema: ObjectInputSchema = {
  type: "object",
  required: ["id"],
  properties: { id: uuidSchema },
  additionalProperties: true,
};
export const characterNameSchema: InputSchema<string> = {
  type: "string",
  minLength: 1,
  maxLength: 100,
};
/** Changes remain a partial domain patch; merged-sheet rules run under the transaction lock. */
export const updateCharacterEnvelopeSchema: ObjectInputSchema = {
  type: "object",
  required: ["expectedRevision", "changes"],
  properties: {
    expectedRevision: revisionSchema,
    changes: { type: "object", required: [], additionalProperties: true },
  },
  additionalProperties: true,
};
export const characterActiveSchema: InputSchema<{ active: boolean }> = {
  type: "object",
  required: ["active"],
  properties: { active: { type: "boolean" } },
  additionalProperties: true,
};
export const characterControllerSchema: ObjectInputSchema = {
  type: "object",
  required: ["membershipId"],
  properties: { membershipId: { anyOf: [uuidSchema, { type: "null" }] } },
  additionalProperties: true,
};

const experienceValue = { type: "integer", minimum: 0, maximum: 2147483647 };
const experience = {
  type: "object",
  required: ["current", "total"],
  properties: { current: experienceValue, total: experienceValue },
  additionalProperties: false,
};
const classLevels = {
  type: "array",
  maxItems: 5,
  items: {
    type: "object",
    required: ["gameClassId", "level"],
    properties: { gameClassId: uuidSchema, level: { type: "integer", minimum: 1, maximum: 10 } },
    additionalProperties: false,
  },
};
const skillRanks = {
  type: "array",
  maxItems: 50,
  items: {
    type: "object",
    required: ["skillId", "rank"],
    properties: { skillId: uuidSchema, rank: { type: "integer", minimum: 1, maximum: 10 } },
    additionalProperties: false,
  },
};
export const progressionChangesSchema: ObjectInputSchema = {
  type: "object",
  minProperties: 1,
  properties: { experience, classLevels, skillRanks },
  additionalProperties: false,
};
