import type { InputSchema } from "./types.ts";

export const uuidSchema: InputSchema<string> = {
  type: "string",
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
};
export const revisionSchema: InputSchema<number> = { type: "integer", minimum: 0 };
export const int32Schema: InputSchema<number> = {
  type: "integer",
  minimum: -2147483648,
  maximum: 2147483647,
};
export const objectSchema: InputSchema<Record<string, unknown>> = {
  type: "object",
  required: [],
  additionalProperties: true,
};
