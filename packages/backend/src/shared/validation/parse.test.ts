import { describe, expect, it } from "vite-plus/test";
import { checkSchema, compileSchema, parseSchema } from "./parse.ts";

const profileSchema = {
  type: "object",
  required: ["name", "level"],
  properties: {
    name: { type: "string", minLength: 1 },
    level: { type: "integer", minimum: 1 },
  },
  additionalProperties: false,
} as const;

describe("shared schema validation", () => {
  it("returns the accepted input without coercion, defaults, or stripping fields", () => {
    const validate = compileSchema<{ name: string; level: number }>(profileSchema);
    const input = { name: "Hero", level: 1 };
    expect(parseSchema(validate, input, "profile")).toBe(input);
    const rejected = { name: "Hero", level: "1", extra: true };
    expect(checkSchema(validate, rejected, "profile").success).toBe(false);
    expect(rejected).toEqual({ name: "Hero", level: "1", extra: true });
    expect(() => parseSchema(validate, null, "profile")).toThrowError(
      expect.objectContaining({ code: "validation", field: "profile", message: "Invalid value." }),
    );
  });

  it("collects all requested field failures and snapshots them before another validation", () => {
    const validate = compileSchema<{ name: string; level: number }>(profileSchema, {
      allErrors: true,
    });
    const result = checkSchema(validate, { name: "", level: 0 }, "profile");
    expect(result).toEqual({
      success: false,
      issues: [
        { field: "name", message: "Invalid value." },
        { field: "level", message: "Invalid value." },
      ],
    });
    expect(checkSchema(validate, { name: "Hero", level: 1 }, "profile").success).toBe(true);
    expect(result.success ? [] : result.issues).toHaveLength(2);
    expect(checkSchema(validate, {}, "profile")).toEqual({
      success: false,
      issues: [
        { field: "name", message: "Invalid value." },
        { field: "level", message: "Invalid value." },
      ],
    });
  });

  it("decodes JSON pointer property names and keeps first-error parsing compatible", () => {
    const validate = compileSchema<{ "a/b~c": number }>({
      type: "object",
      required: ["a/b~c"],
      properties: { "a/b~c": { type: "integer" } },
      additionalProperties: false,
    });
    expect(() => parseSchema(validate, { "a/b~c": "bad" }, "profile")).toThrowError(
      expect.objectContaining({ code: "validation", field: "a/b~c" }),
    );
    const firstOnly = compileSchema<{ name: string; level: number }>(profileSchema);
    const result = checkSchema(firstOnly, { name: "", level: 0 }, "profile");
    expect(result.success ? [] : result.issues).toHaveLength(1);
  });
});
