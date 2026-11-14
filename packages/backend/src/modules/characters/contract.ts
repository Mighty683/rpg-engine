import { compileSchema, compileObjectSchema } from "../../shared/validation/parse.ts";
import { parseEnvelope, parseFields } from "../../shared/http/validation.ts";
import type {
  CreateCharacterInput,
  UpdateCharacterInput,
  CharacterControllerInput,
} from "./types.ts";
import {
  createCharacterEnvelopeSchema,
  characterNameSchema,
  updateCharacterEnvelopeSchema,
  characterActiveSchema,
  characterControllerSchema,
} from "./schema.ts";

const createEnvelope = compileObjectSchema(createCharacterEnvelopeSchema);
const nameValidator = compileSchema(characterNameSchema);
const updateEnvelope = compileObjectSchema(updateCharacterEnvelopeSchema);
const activeValidator = compileSchema(characterActiveSchema);
const controllerValidator = compileObjectSchema(characterControllerSchema);

export function parseCreateCharacter(value: unknown): CreateCharacterInput {
  const body = parseEnvelope(createEnvelope, value);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  parseFields(nameValidator, name, "name", {
    name: "Enter a character name of at most 100 characters.",
  });
  return { id: body.id as string, name };
}
export function parseUpdateCharacter(value: unknown): UpdateCharacterInput {
  const body = parseEnvelope(updateEnvelope, value);
  return {
    expectedRevision: body.expectedRevision as number,
    changes: body.changes as UpdateCharacterInput["changes"],
  };
}
export const parseCharacterActive = (value: unknown) => parseEnvelope(activeValidator, value);
export function parseCharacterController(value: unknown): CharacterControllerInput {
  const body = parseEnvelope(controllerValidator, value);
  return { membershipId: body.membershipId as string | null };
}
