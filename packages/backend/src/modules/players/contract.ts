import { compileObjectSchema, compileSchema } from "../../shared/validation/parse.ts";
import { uuidSchema } from "../../shared/validation/schema.ts";
import { parseEnvelope } from "../../shared/http/validation.ts";
import { activeCharacterSchema } from "./schema.ts";
import type { ActiveCharacterInput } from "./types.ts";

const validateSelection = compileObjectSchema(activeCharacterSchema);
const validateId = compileSchema(uuidSchema);
export const parseMemberId = (value: unknown) => parseEnvelope(validateId, value);
export function parseActiveCharacter(value: unknown): ActiveCharacterInput {
  const body = parseEnvelope(validateSelection, value);
  return {
    expectedRevision: body.expectedRevision as number,
    characterId: body.characterId as string | null,
  };
}
