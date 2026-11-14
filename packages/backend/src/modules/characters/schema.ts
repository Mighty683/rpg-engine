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
