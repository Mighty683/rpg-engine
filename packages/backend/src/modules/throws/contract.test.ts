import { expect, it } from "vite-plus/test";
import { parseCreateRequest, parseThrowListQuery } from "./contract.ts";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const attribute = {
  type: "attribute",
  characterId: id,
  expectedRevision: 0,
  attributes: ["DEX", "MIG"],
  dice: { DEX: 8 },
  modifier: 0,
  redDice: [],
  redModifier: 0,
  note: " test ",
};
const weapon = {
  type: "weapon",
  characterId: id,
  equipmentId: id,
  expectedRevision: 0,
  dice: [8, 8],
  modifier: 0,
  note: " test ",
};
const free = {
  type: "free",
  characterId: "gm",
  dice: [4, 20],
  modifier: 0,
  redDice: [],
  redModifier: 0,
  note: " test ",
};
const { characterId: _attributeId, ...npcAttribute } = attribute;
const { characterId: _weaponId, equipmentId: _equipmentId, ...npcAttack } = weapon;
it.each([
  attribute,
  weapon,
  free,
  { ...npcAttribute, type: "npc-attribute", npcId: id },
  { ...npcAttack, type: "npc-attack", npcId: id, attackId: id },
])("normalizes setup $type without mutating input", (setup) => {
  const input = { setup };
  expect(parseCreateRequest(input)).toEqual({
    setup: { ...setup, note: "test" },
    private: false,
    sourceThrowId: null,
  });
  expect(input.setup.note).toBe(" test ");
});
it.each([
  [null, "bad_request", "", "Expected a JSON object"],
  [{ setup: free, authorAccountId: id }, "validation", "", "Unknown  field"],
  [{ setup: free, private: "false" }, "validation", "/private", "Invalid privacy setting"],
  [
    { setup: { ...free, modifier: "0" } },
    "validation",
    "/modifier",
    "Modifier must be a 32-bit integer",
  ],
  [{ setup: { ...attribute, dice: { LUCK: 8 } } }, "validation", "/dice", "Unknown attribute die"],
  [
    { setup: { ...attribute, dice: { DEX: 20 } } },
    "validation",
    "/dice",
    "Attribute dice use d6, d8, d10 or d12",
  ],
  [{ setup: { ...weapon, dice: [8] } }, "validation", "/dice", "Choose 2 valid dice"],
  [
    { setup: { ...free, note: "😀".repeat(501) } },
    "validation",
    "/note",
    "Note must be 500 characters or fewer",
  ],
])("preserves roll validation error contract %#", (input, code, field, message) => {
  expect(() => parseCreateRequest(input)).toThrowError(
    expect.objectContaining({ code, field, message }),
  );
});
it("preserves query defaults, clamping and invalid cursor response", () => {
  for (const limit of [undefined, null, "bad", "-1", ["10"]])
    expect(parseThrowListQuery({ limit })).toEqual({ before: null, limit: 20 });
  expect(parseThrowListQuery({ limit: "0", before: "" })).toEqual({ before: null, limit: 1 });
  expect(parseThrowListQuery({ limit: "999", before: id })).toEqual({ before: id, limit: 100 });
  expect(() => parseThrowListQuery({ before: "bad" })).toThrowError(
    expect.objectContaining({ code: "bad_request", message: "Invalid cursor." }),
  );
});
