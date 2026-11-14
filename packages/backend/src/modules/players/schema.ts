import type { ObjectInputSchema } from "../../shared/validation/types.ts";
import { uuidSchema, revisionSchema } from "../../shared/validation/schema.ts";

export const activeCharacterSchema: ObjectInputSchema = {
  type: "object",
  required: ["expectedRevision", "characterId"],
  properties: {
    expectedRevision: revisionSchema,
    characterId: { anyOf: [uuidSchema, { type: "null" }] },
  },
  additionalProperties: true,
};
