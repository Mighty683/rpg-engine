import type { JSONSchemaType, ValidateFunction, SchemaObject } from "ajv";

/** JSON Schema checked against its corresponding application input type. */
export type InputSchema<T> = JSONSchemaType<T>;

export type SchemaValidator<T> = ValidateFunction<T>;
export type SchemaCompileOptions = { allErrors?: boolean };
export type ValidationFields = Record<string, string>;
export type ValidationIssue = { field: string; message: string };
export type SchemaResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] };

/** Envelope validation proves object shape; field values remain unknown until parsed. */
export type ObjectInputSchema = SchemaObject & { type: "object" };
