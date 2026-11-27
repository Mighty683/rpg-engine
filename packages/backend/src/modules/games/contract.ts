import { objectSchema } from "../../shared/validation/schema.ts";
import { parseEnvelope } from "../../shared/http/validation.ts";
import { checkSchema, compileSchema } from "../../shared/validation/parse.ts";
import { gameSchema } from "./schema.ts";
import { findSystem } from "../rpg-systems/catalog.ts";
import type { GameValidation } from "./types.ts";

const validate = compileSchema(gameSchema, { allErrors: true });

export function validateGame(input: unknown): GameValidation {
  const value =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const systemId = typeof value.systemId === "string" ? value.systemId : "";
  const fields: Record<string, string> = {};
  const checked = checkSchema(validate, { name, systemId }, "game");
  if (!checked.success && checked.issues.some((issue) => issue.field === "name"))
    fields.name = !name ? "name_required" : "name_length";
  if (!findSystem(systemId)) fields.systemId = "system_required";
  return { name, systemId, fields };
}

const validateEnvelope = compileSchema(objectSchema);
export const parseGameEnvelope = (value: unknown) =>
  parseEnvelope(validateEnvelope, value, "Expected a JSON object.");
