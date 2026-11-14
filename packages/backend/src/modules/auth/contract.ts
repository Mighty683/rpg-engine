import { checkSchema, compileSchema } from "../../shared/validation/parse.ts";
import { credentialsSchema, credentialTextSchema } from "./schema.ts";
import type { CredentialsValidation, CredentialsInput } from "./types.ts";

const validate = compileSchema(credentialsSchema, { allErrors: true });

export function validateCredentials(input: unknown): CredentialsValidation {
  const value =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const username = typeof value.username === "string" ? value.username.trim() : "";
  const password = typeof value.password === "string" ? value.password : "";
  const fields: Record<string, string> = {};
  const checked = checkSchema(validate, { username, password }, "credentials");
  if (!checked.success && checked.issues.some((issue) => issue.field === "username"))
    fields.username = "Use 3–32 letters, numbers, dots, underscores, or hyphens.";
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 1024)
    fields.password = "Use at least 8 characters and at most 1024 bytes.";
  return { username, password, fields };
}

const validateText = compileSchema(credentialTextSchema);
export function parseLoginCredentials(input: unknown): CredentialsInput {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const username = validateText(body.username) ? body.username.trim().slice(0, 128) : "";
  const password =
    validateText(body.password) && Buffer.byteLength(body.password, "utf8") <= 1024
      ? body.password
      : "";
  return { username, password };
}
