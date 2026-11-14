import { describe, expect, it } from "vite-plus/test";
import {
  parseNpcWrite,
  parseNpcCreateEnvelope,
  parseNpcUpdateEnvelope,
  parseNpcRemoveEnvelope,
  parseNpcRevision,
} from "./contract.ts";
import type { NpcWrite } from "./types.ts";

const profile: NpcWrite = {
  name: "Goblin",
  relationship: "enemy",
  level: 5,
  visibility: "hidden",
  baseDice: { DEX: 6, INS: 8, MIG: 10, WLP: 12 },
  hp: { current: 10, max: 20 },
  mp: { current: 0, max: 0 },
  defense: 8,
  magicDefense: 8,
  attacks: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Sword",
      reach: "melee",
      attributes: ["DEX", "MIG"],
      damageBonus: 5,
      damageType: "physical",
    },
  ],
  notes: "",
};

describe("NPC replacement schema", () => {
  it("normalizes names and identifiers without mutating the input or trimming notes", () => {
    const input = {
      ...profile,
      name: "  Goblin  ",
      notes: "  keep these spaces  ",
      attacks: [
        { ...profile.attacks[0]!, name: " Sword ", id: profile.attacks[0]!.id.toUpperCase() },
      ],
    };
    const original = structuredClone(input);
    expect(parseNpcWrite(input)).toEqual({ ...profile, notes: input.notes });
    expect(input).toEqual(original);
  });

  it("preserves Unicode code-point limits and integer boundaries", () => {
    const input = {
      ...profile,
      name: "😀".repeat(100),
      notes: "😀".repeat(2000),
      level: 60,
      hp: { current: 2147483647, max: 2147483647 },
      defense: 2147483647,
      magicDefense: 0,
      attacks: [{ ...profile.attacks[0]!, damageBonus: -2147483648 }],
    };
    expect(parseNpcWrite(input)).toEqual(input);
    expect(parseNpcWrite({ ...profile, attacks: [] }).attacks).toEqual([]);
  });

  it.each([
    ["null profile", null, "npc"],
    ["array profile", [], "npc"],
    ["unknown authoritative field", { ...profile, gameId: "injected" }, "npc"],
    ["missing field", { ...profile, notes: undefined }, "notes"],
    ["blank name", { ...profile, name: "  " }, "name"],
    ["long Unicode name", { ...profile, name: "😀".repeat(101) }, "name"],
    ["long notes", { ...profile, notes: "a".repeat(2001) }, "notes"],
    ["numeric string", { ...profile, level: "5" }, "level"],
    ["fractional level", { ...profile, level: 5.5 }, "level"],
    ["low level", { ...profile, level: 4 }, "level"],
    ["high level", { ...profile, level: 61 }, "level"],
    ["invalid relationship", { ...profile, relationship: "owner" }, "relationship"],
    ["invalid visibility", { ...profile, visibility: "public" }, "visibility"],
    ["invalid die", { ...profile, baseDice: { ...profile.baseDice, DEX: 20 } }, "baseDice.DEX"],
    ["extra die", { ...profile, baseDice: { ...profile.baseDice, LUCK: 6 } }, "baseDice"],
    ["extra resource field", { ...profile, hp: { ...profile.hp, bonus: 1 } }, "hp"],
    ["resource above maximum", { ...profile, hp: { current: 21, max: 20 } }, "hp.current"],
    ["negative resource", { ...profile, mp: { current: -1, max: 0 } }, "mp.current"],
    ["integer overflow", { ...profile, defense: 2147483648 }, "defense"],
    ["negative defense", { ...profile, magicDefense: -1 }, "magicDefense"],
    ["non-finite defense", { ...profile, defense: Infinity }, "defense"],
    ["invalid attacks", { ...profile, attacks: {} }, "attacks"],
    ["too many attacks", { ...profile, attacks: Array(101).fill(profile.attacks[0]) }, "attacks"],
    [
      "extra attack field",
      { ...profile, attacks: [{ ...profile.attacks[0], owner: "injected" }] },
      "attacks.0",
    ],
    [
      "invalid attack ID",
      { ...profile, attacks: [{ ...profile.attacks[0], id: "bad" }] },
      "attacks.0.id",
    ],
    [
      "invalid reach",
      { ...profile, attacks: [{ ...profile.attacks[0], reach: "far" }] },
      "attacks.0.reach",
    ],
    [
      "short attribute tuple",
      { ...profile, attacks: [{ ...profile.attacks[0], attributes: ["DEX"] }] },
      "attacks.0.attributes",
    ],
    [
      "invalid attribute",
      { ...profile, attacks: [{ ...profile.attacks[0], attributes: ["DEX", "LUCK"] }] },
      "attacks.0.attributes.1",
    ],
    [
      "damage overflow",
      { ...profile, attacks: [{ ...profile.attacks[0], damageBonus: 2147483648 }] },
      "attacks.0.damageBonus",
    ],
    [
      "duplicate normalized IDs",
      {
        ...profile,
        attacks: [
          profile.attacks[0],
          { ...profile.attacks[0], id: profile.attacks[0]!.id.toUpperCase() },
        ],
      },
      "attacks",
    ],
  ])("rejects %s with an application validation error", (_name, input, field) => {
    expect(() => parseNpcWrite(input)).toThrowError(
      expect.objectContaining({ code: "validation", field, message: "Invalid value." }),
    );
  });
});

it("preserves strict NPC envelope failures separately from profile/revision validation", () => {
  const input = { id: profile.attacks[0]!.id, npc: null };
  expect(parseNpcCreateEnvelope(input)).toBe(input);
  expect(parseNpcUpdateEnvelope({ expectedRevision: "bad", npc: null })).toEqual({
    expectedRevision: "bad",
    npc: null,
  });
  expect(() => parseNpcCreateEnvelope({ ...input, forged: true })).toThrowError(
    expect.objectContaining({ httpCode: 400 }),
  );
  expect(() => parseNpcRemoveEnvelope({ expectedRevision: 0, forged: true })).toThrowError(
    expect.objectContaining({ httpCode: 400 }),
  );
  expect(() => parseNpcRevision("0")).toThrowError(expect.objectContaining({ httpCode: 400 }));
  expect(() => parseNpcRevision(2147483648)).toThrowError(
    expect.objectContaining({ httpCode: 400 }),
  );
  expect(parseNpcRevision(2147483647)).toBe(2147483647);
});
