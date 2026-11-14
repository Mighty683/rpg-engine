import { expect, it } from "vite-plus/test";
import { compileSchema } from "../validation/parse.ts";
import { parseEnvelope, parseFields } from "./validation.ts";

const validate = compileSchema<{ name: string; level: number }>(
  {
    type: "object",
    required: ["name", "level"],
    properties: { name: { type: "string", minLength: 1 }, level: { type: "integer", minimum: 1 } },
    additionalProperties: false,
  },
  { allErrors: true },
);

it("keeps envelope failures at 400 without exposing field details", () => {
  const input = { name: "Hero", level: 1 };
  expect(parseEnvelope(validate, input)).toBe(input);
  expect(() => parseEnvelope(validate, {})).toThrowError(
    expect.objectContaining({
      httpCode: 400,
      response: { error: { code: "bad_request", message: "Invalid request." } },
    }),
  );
  expect(() => parseEnvelope(validate, null, "Expected a JSON object.")).toThrowError(
    expect.objectContaining({
      httpCode: 400,
      response: { error: { code: "bad_request", message: "Expected a JSON object." } },
    }),
  );
});

it("maps multiple field failures to the existing 422 envelope and supplied messages", () => {
  const input = { name: "Hero", level: 1 };
  expect(parseFields(validate, input, "profile")).toBe(input);
  expect(() =>
    parseFields(validate, { name: "", level: 0 }, "profile", { name: "Enter a name" }),
  ).toThrowError(
    expect.objectContaining({
      httpCode: 422,
      response: {
        error: {
          code: "validation",
          message: "Check the fields.",
          fields: { name: "Enter a name", level: "Invalid value." },
        },
      },
    }),
  );
  expect(() => parseFields(validate, null, "constructor")).toThrowError(
    expect.objectContaining({
      httpCode: 422,
      response: {
        error: {
          code: "validation",
          message: "Check the fields.",
          fields: { constructor: "Invalid value." },
        },
      },
    }),
  );
});
