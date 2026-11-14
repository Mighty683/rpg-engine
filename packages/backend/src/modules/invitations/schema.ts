import type { ObjectInputSchema, InputSchema } from "../../shared/validation/types.ts";
import { uuidSchema } from "../../shared/validation/schema.ts";
import type { UpdateInvitationInput, AcceptInvitationInput } from "./types.ts";

export const createInvitationSchema: ObjectInputSchema = {
  type: "object",
  anyOf: [
    { required: ["kind"], properties: { kind: { const: "game" } } },
    {
      required: ["kind", "characterId"],
      properties: { kind: { const: "character" }, characterId: uuidSchema },
    },
  ],
  additionalProperties: true,
};
export const updateInvitationSchema: InputSchema<UpdateInvitationInput> = {
  type: "object",
  required: ["enabled"],
  properties: { enabled: { type: "boolean" } },
  additionalProperties: true,
};
export const acceptInvitationSchema: InputSchema<AcceptInvitationInput> = {
  type: "object",
  required: ["makeActive"],
  properties: { makeActive: { type: "boolean" } },
  additionalProperties: true,
};
