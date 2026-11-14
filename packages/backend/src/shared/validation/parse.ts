import { Ajv, type ErrorObject } from "ajv";
import type {
  InputSchema,
  SchemaCompileOptions,
  SchemaResult,
  SchemaValidator,
  ObjectInputSchema,
} from "./types.ts";

const options = {
  strict: true,
  coerceTypes: false,
  removeAdditional: false,
  useDefaults: false,
  ownProperties: true,
};
const validator = new Ajv(options);
const allErrorsValidator = new Ajv({ ...options, allErrors: true });

/** Compile trusted application schemas once, outside request handlers. */
export function compileSchema<T>(
  schema: InputSchema<T>,
  options: SchemaCompileOptions = {},
): SchemaValidator<T> {
  return (options.allErrors ? allErrorsValidator : validator).compile(schema);
}

/** Envelope schemas deliberately leave selected fields unknown for a later validation stage. */
export function compileObjectSchema(
  schema: ObjectInputSchema,
): SchemaValidator<Record<string, unknown>> {
  return validator.compile<Record<string, unknown>>(schema);
}

export function invalidValue(field: string): never {
  throw Object.assign(new Error("Invalid value."), { code: "validation", field });
}

function errorField(error: ErrorObject, rootField: string): string {
  const path = error.instancePath
    ? error.instancePath
        .slice(1)
        .split("/")
        .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    : [];
  if (error.keyword === "required") path.push(String(error.params.missingProperty));
  return path.length ? path.join(".") : rootField;
}

/** Capture errors immediately; Ajv reuses each validator's error slot on the next call. */
export function checkSchema<T>(
  validate: SchemaValidator<T>,
  value: unknown,
  rootField: string,
): SchemaResult<T> {
  if (validate(value)) return { success: true, data: value };
  const issues = validate.errors?.map((error) => ({
    field: errorField(error, rootField),
    message: "Invalid value.",
  })) ?? [{ field: rootField, message: "Invalid value." }];
  return { success: false, issues };
}

/** Retain the first-field domain error contract used by existing NPC callers. */
export function parseSchema<T>(validate: SchemaValidator<T>, value: unknown, rootField: string): T {
  const result = checkSchema(validate, value, rootField);
  if (result.success) return result.data;
  return invalidValue(result.issues[0]?.field ?? rootField);
}
