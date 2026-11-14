import { compileObjectSchema, compileSchema } from "../../shared/validation/parse.ts";
import { uuidSchema } from "../../shared/validation/schema.ts";
import { parseEnvelope } from "../../shared/http/validation.ts";
import {
  createInvitationSchema,
  updateInvitationSchema,
  acceptInvitationSchema,
} from "./schema.ts";
import type { CreateInvitationInput } from "./types.ts";

const validateCreate = compileObjectSchema(createInvitationSchema);
const validateUpdate = compileSchema(updateInvitationSchema);
const validateAccept = compileSchema(acceptInvitationSchema);
const validateId = compileSchema(uuidSchema);
export const parseInvitationId = (value: unknown) => parseEnvelope(validateId, value);
export function parseCreateInvitation(value: unknown): CreateInvitationInput {
  // An absent/falsy body historically creates the game invitation.
  const body = parseEnvelope(validateCreate, value || { kind: "game" });
  return body.kind === "game"
    ? { kind: "game" }
    : { kind: "character", characterId: body.characterId as string };
}
export const parseUpdateInvitation = (value: unknown) => parseEnvelope(validateUpdate, value);
export function parseAcceptInvitation(value: unknown) {
  const makeActive = (value as { makeActive?: unknown } | null | undefined)?.makeActive ?? true;
  return parseEnvelope(validateAccept, { makeActive });
}
