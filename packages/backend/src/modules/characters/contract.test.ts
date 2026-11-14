import { expect, it } from "vite-plus/test";
import {
  parseCreateCharacter,
  parseUpdateCharacter,
  parseCharacterActive,
  parseCharacterController,
} from "./contract.ts";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
it("preserves permissive envelopes, Unicode names, and unmerged partial changes", () => {
  expect(parseCreateCharacter({ id, name: ` ${"😀".repeat(100)} `, ignored: true })).toEqual({
    id,
    name: "😀".repeat(100),
  });
  const changes = { resources: { hp: 1 } };
  expect(parseUpdateCharacter({ expectedRevision: 0, changes, ignored: true })).toEqual({
    expectedRevision: 0,
    changes,
  });
  expect(parseCharacterActive({ active: false, ignored: true })).toEqual({
    active: false,
    ignored: true,
  });
  expect(parseCharacterController({ membershipId: null, ignored: true })).toEqual({
    membershipId: null,
  });
});
it("keeps envelope errors at 400 and name errors at 422", () => {
  for (const value of [null, [], { id: 5 }, { id: "bad" }])
    expect(() => parseCreateCharacter(value)).toThrowError(
      expect.objectContaining({ httpCode: 400 }),
    );
  expect(() => parseCreateCharacter({ id, name: " " })).toThrowError(
    expect.objectContaining({
      httpCode: 422,
      response: {
        error: {
          code: "validation",
          message: "Check the fields.",
          fields: { name: "Enter a character name of at most 100 characters." },
        },
      },
    }),
  );
  for (const value of [
    { expectedRevision: "0", changes: {} },
    { expectedRevision: 0, changes: [] },
  ])
    expect(() => parseUpdateCharacter(value)).toThrowError(
      expect.objectContaining({ httpCode: 400 }),
    );
  expect(() => parseCharacterActive({ active: "false" })).toThrowError(
    expect.objectContaining({ httpCode: 400 }),
  );
  expect(() => parseCharacterController({ membershipId: "bad" })).toThrowError(
    expect.objectContaining({ httpCode: 400 }),
  );
});
