import { checkSchema } from "../validation/parse.ts";
import type { SchemaValidator, ValidationFields } from "../validation/types.ts";
import { badRequest, validationError } from "./errors.ts";

/** Select the endpoint's envelope policy explicitly instead of turning every failure into 422. */
export function parseEnvelope<T>(
  validate: SchemaValidator<T>,
  value: unknown,
  message = "Invalid request.",
): T {
  if (validate(value)) return value;
  return badRequest(message);
}

/** Compile with allErrors when the endpoint promises multiple field errors. */
export function parseFields<T>(
  validate: SchemaValidator<T>,
  value: unknown,
  rootField: string,
  messages: ValidationFields = {},
): T {
  const result = checkSchema(validate, value, rootField);
  if (result.success) return result.data;
  const fields = Object.fromEntries(
    result.issues.map((issue) => [
      issue.field,
      Object.hasOwn(messages, issue.field) ? messages[issue.field] : issue.message,
    ]),
  );
  return validationError(fields);
}
