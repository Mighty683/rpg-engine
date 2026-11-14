/** Structural comparison for the supported request-schema vocabulary, not a general schema prover. */
export type Schema = {
  [key: string]: unknown;
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  items?: Schema | Schema[] | boolean;
  prefixItems?: Schema[];
  additionalProperties?: Schema | boolean;
  propertyNames?: Schema;
};
const annotations = new Set([
  "$schema",
  "description",
  "title",
  "default",
  "examples",
  "example",
  "format",
]);
const scalars = new Set([
  "type",
  "const",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
]);

/** Translate draft-07 tuple items to 2020-12 prefixItems; never emit array-form items in OpenAPI 3.1. */
export function structuralSchema(
  input: Schema | boolean,
  resolve: (ref: string) => Schema,
): Schema | boolean {
  if (typeof input === "boolean") return input;
  if (typeof input.$ref === "string") {
    const { $ref, ...siblings } = input;
    return structuralSchema({ ...resolve($ref), ...siblings }, resolve);
  }
  const schema = { ...input };
  if (Array.isArray(schema.items)) {
    schema.prefixItems = schema.items;
    schema.items = (schema.additionalItems as Schema | boolean | undefined) ?? true;
    delete schema.additionalItems;
  }
  // An enum of property names plus one value schema is equivalent to named optional properties.
  if (schema.propertyNames && Array.isArray(schema.propertyNames.enum)) {
    const names = schema.propertyNames;
    if (
      names.type !== "string" ||
      Object.keys(names).some((key) => !["type", "enum"].includes(key)) ||
      schema.properties
    )
      throw new Error("Unsupported propertyNames comparison");
    schema.properties = Object.fromEntries(
      (names.enum as string[]).map((name) => [name, schema.additionalProperties as Schema]),
    );
    schema.additionalProperties = false;
    delete schema.propertyNames;
  }
  const result: Schema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (annotations.has(key)) continue;
    if (scalars.has(key)) {
      result[key] = value;
      continue;
    }
    if (key === "required" || key === "enum") {
      const values = [...(value as string[])].sort();
      if (key === "enum" || values.length) result[key] = values;
      continue;
    }
    if (key === "properties") {
      result.properties = Object.fromEntries(
        Object.entries(value as Record<string, Schema>).map(([name, child]) => [
          name,
          structuralSchema(child, resolve) as Schema,
        ]),
      );
      continue;
    }
    if (["items", "additionalProperties"].includes(key)) {
      if (value !== true) result[key] = structuralSchema(value as Schema | boolean, resolve);
      continue;
    }
    if (["prefixItems", "oneOf", "anyOf", "allOf"].includes(key)) {
      result[key] = (value as Schema[]).map((child) => structuralSchema(child, resolve));
      continue;
    }
    throw new Error(`Unsupported structural schema keyword: ${key}`);
  }
  return result;
}
