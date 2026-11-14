import { expect, it } from "vite-plus/test";
import { parseActiveCharacter, parseMemberId } from "./contract.ts";
it("keeps selection revisions numeric and preserves null selection and ignored extra keys", () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  expect(parseActiveCharacter({ expectedRevision: 0, characterId: null, ignored: true })).toEqual({
    expectedRevision: 0,
    characterId: null,
  });
  expect(parseMemberId(id)).toBe(id);
  for (const value of [
    null,
    { expectedRevision: "0", characterId: id },
    { expectedRevision: -1, characterId: null },
    { expectedRevision: 0, characterId: "bad" },
  ])
    expect(() => parseActiveCharacter(value)).toThrowError(
      expect.objectContaining({ httpCode: 400 }),
    );
});
