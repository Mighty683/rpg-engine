import { describe, expect, it, vi } from "vite-plus/test";
import { defaultSheet, type FabulaSheet } from "../fabula/rules.ts";
import type { DieSource } from "../fabula/rolls.ts";
import type { CreateThrowInput, ResolvedSetup, ThrowKind } from "./contract.ts";
import { parseCreateRequest } from "./contract.ts";
import { resolveThrow, type ResolutionContext, type RollCharacter } from "./resolve.ts";

const scripted = (faces: number[]): DieSource => {
  let index = 0;
  return () => faces[Math.min(index++, faces.length - 1)]!;
};

const sheet = (overrides: Partial<FabulaSheet> = {}): FabulaSheet => ({
  ...defaultSheet("Hero"),
  equipment: [
    { id: "weapon-1", name: "Rapier", notes: "", priceZenit: null, kind: "weapon", equipped: true, accuracyDice: ["DEX", "INS"], accuracyBonus: 1 },
    { id: "weapon-2", name: "Broken blade", notes: "", priceZenit: null, kind: "weapon", equipped: false, accuracyDice: ["DEX", null], accuracyBonus: null },
  ],
  ...overrides,
});

const character = (overrides: Partial<RollCharacter> = {}): RollCharacter => ({
  id: "char-1",
  playerId: "member-1",
  revision: 3,
  name: "Hero",
  sheet: sheet(),
  ...overrides,
});

const gmContext = (overrides: Partial<ResolutionContext> = {}): ResolutionContext => ({
  role: "GM",
  membershipId: null,
  activeCharacterIds: ["char-1"],
  ownActiveCharacterId: null,
  character: character(),
  weapon: sheet().equipment[0] as Extract<FabulaSheet["equipment"][number], { kind: "weapon" }>,
  source: null,
  ...overrides,
});

const playerContext = (overrides: Partial<ResolutionContext> = {}): ResolutionContext => ({
  ...gmContext(),
  role: "Player",
  membershipId: "member-1",
  ownActiveCharacterId: "char-1",
  ...overrides,
});

const attributeInput = (overrides: Partial<Extract<CreateThrowInput["setup"], { type: "attribute" }>> = {}): CreateThrowInput => ({
  sourceThrowId: null,
  setup: {
    type: "attribute",
    characterId: "char-1",
    expectedRevision: 3,
    attributes: ["DEX", "MIG"],
    dice: {},
    modifier: 2,
    redDice: [],
    redModifier: 0,
    note: "",
    ...overrides,
  },
});

const freeInput = (overrides: Partial<Extract<CreateThrowInput["setup"], { type: "free" }>> = {}): CreateThrowInput => ({
  sourceThrowId: null,
  setup: { type: "free", characterId: "gm", dice: [8], modifier: 0, redDice: [], redModifier: 0, note: "", ...overrides },
});

const weaponInput = (overrides: Partial<Extract<CreateThrowInput["setup"], { type: "weapon" }>> = {}): CreateThrowInput => ({
  sourceThrowId: null,
  setup: { type: "weapon", characterId: "char-1", equipmentId: "weapon-1", expectedRevision: 3, dice: [8, 10], modifier: 1, note: "", ...overrides },
});

const expectFailure = (run: () => unknown, code: string) => {
  try {
    run();
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code);
    return;
  }
  throw new Error(`Expected failure ${code}`);
};

describe("attribute throws", () => {
  it("resolves a two-attribute check with critical, fumble and ordinary classification", () => {
    expect(resolveThrow(attributeInput(), gmContext(), scripted([6, 6])).outcome.first).toMatchObject({ total: 14, result: "critical" });
    expect(resolveThrow(attributeInput(), gmContext(), scripted([1, 1])).outcome.first).toMatchObject({ total: 4, result: "fumble" });
    const ordinary = resolveThrow(attributeInput(), gmContext(), scripted([3, 5]));
    expect(ordinary.outcome.first).toMatchObject({ total: 10, result: "ordinary" });
    expect(ordinary.kind).toBe("attribute-check");
    expect(ordinary.setup.dice).toEqual([
      { label: "DEX", size: 8 },
      { label: "MIG", size: 6 },
    ]);
  });

  it("applies effective die overrides and repeated attributes with independent faces", () => {
    const resolved = resolveThrow(attributeInput({ attributes: ["DEX", "DEX"], dice: { DEX: 12 } }), gmContext(), scripted([7, 2]));
    expect(resolved.setup.dice).toEqual([
      { label: "DEX", size: 12 },
      { label: "DEX", size: 12 },
    ]);
    expect(resolved.outcome.first.dice.map((die) => die.face)).toEqual([7, 2]);
    expect(resolved.outcome.first.total).toBe(9 + 2);
  });

  it("records a single-die attribute roll as a generic roll without classification", () => {
    const resolved = resolveThrow(attributeInput({ attributes: ["WLP"], redDice: [] }), gmContext(), scripted([4]));
    expect(resolved.kind).toBe("attribute-roll");
    expect(resolved.outcome.first).toMatchObject({ total: 6, result: "none" });
  });

  it("resolves an opposed attribute check with independently selected opposing dice", () => {
    const input = attributeInput({ redDice: [12, 10], redModifier: 1 });
    const resolved = resolveThrow(input, gmContext(), scripted([6, 6, 1, 1]));
    expect(resolved.kind).toBe("opposed-check");
    expect(resolved.outcome.winner).toBe("first");
    expect(resolved.outcome.first).toMatchObject({ total: 14, result: "critical" });
    expect(resolved.outcome.second).toMatchObject({ total: 3, result: "fumble", modifier: 1 });
    expect(resolved.setup.redDice).toEqual([
      { label: "DEX", size: 12 },
      { label: "MIG", size: 10 },
    ]);
  });

  it("treats one friendly attribute die against two red dice as a generic opposed roll compared by totals", () => {
    const input = attributeInput({ attributes: ["INS"], redDice: [10, 12], redModifier: 2 });
    const resolved = resolveThrow(input, gmContext(), scripted([9, 5, 7]));
    expect(resolved.kind).toBe("opposed-roll");
    expect(resolved.outcome.first).toMatchObject({ total: 11, result: "none" });
    expect(resolved.outcome.second).toMatchObject({ total: 14, result: "none" });
    expect(resolved.outcome.winner).toBe("second");
  });

  it.each([{ attributes: ["DEX"] as ["DEX"], faces: [4, 9] }, { attributes: ["DEX", "MIG"] as ["DEX", "MIG"], faces: [4, 3, 9] }])("compares totals when $attributes faces one opposing die", ({ attributes, faces }) => {
    const resolved = resolveThrow(attributeInput({ attributes, redDice: [12] }), gmContext(), scripted(faces));
    expect(resolved.kind).toBe("opposed-roll");
    expect(resolved.setup.redDice).toEqual([{ label: "d12", size: 12 }]);
    expect(resolved.outcome.second).toMatchObject({ total: 9, result: "none" });
    expect(resolved.outcome.first.result).toBe("none");
  });
});

describe("weapon throws", () => {
  it("uses the saved accuracy pair and bonus and keeps them separate from the manual modifier", () => {
    const resolved = resolveThrow(weaponInput(), gmContext(), scripted([4, 5]));
    expect(resolved.kind).toBe("weapon-accuracy");
    expect(resolved.equipmentName).toBe("Rapier");
    expect(resolved.setup.weaponBonus).toBe(1);
    expect(resolved.setup.modifier).toBe(1);
    expect(resolved.setup.dice).toEqual([
      { label: "DEX", size: 8 },
      { label: "INS", size: 10 },
    ]);
    expect(resolved.outcome.first).toMatchObject({ total: 4 + 5 + 2, result: "ordinary" });
  });

  it("rejects foreign, missing and incomplete weapons", () => {
    const broken = sheet().equipment[1] as Extract<FabulaSheet["equipment"][number], { kind: "weapon" }>;
    expectFailure(() => resolveThrow(weaponInput({ equipmentId: "weapon-2" }), gmContext({ weapon: broken }), scripted([])), "weapon_incomplete");
    expectFailure(() => resolveThrow(weaponInput({ equipmentId: "gone" }), gmContext({ weapon: null }), scripted([])), "not_found");
  });

  it("keeps the original accuracy setup on a weapon reroll even if the weapon changed", () => {
    const source: ResolvedSetup = {
      type: "weapon",
      kind: "weapon-accuracy",
      characterId: "char-1",
      equipmentId: "weapon-1",
      dice: [{ label: "DEX", size: 8 }, { label: "INS", size: 10 }],
      modifier: 0,
      redDice: [],
      redModifier: 0,
      note: "",
      weaponBonus: 3,
      accuracyDice: ["DEX", "INS"],
    };
    const context = gmContext({
      source: { kind: "weapon-accuracy", setup: source, characterId: "char-1", equipmentId: "weapon-1" },
      weapon: { id: "weapon-1", name: "Reforged rapier", notes: "", priceZenit: null, kind: "weapon", equipped: true, accuracyDice: ["MIG", "WLP"], accuracyBonus: 9 },
    });
    const resolved = resolveThrow(weaponInput({ sourceThrowId: "src" } as never), context, scripted([2, 3]));
    expect(resolved.setup.weaponBonus).toBe(3);
    expect(resolved.setup.accuracyDice).toEqual(["DEX", "INS"]);
    expect(resolved.outcome.first.total).toBe(2 + 3 + 3 + 1);
  });
});

describe("free throws", () => {
  it("lets the GM roll as the GM or any active character, and classifies opposed free rolls", () => {
    const asGm = resolveThrow(freeInput(), gmContext(), scripted([5]));
    expect(asGm.kind).toBe("free");
    expect(asGm.characterName).toBe("GM");
    expect(asGm.characterId).toBeNull();
    const asCharacter = resolveThrow(freeInput({ characterId: "char-1", dice: [6, 8] }), gmContext(), scripted([6, 6]));
    expect(asCharacter.characterName).toBe("Hero");
    expect(asCharacter.outcome.first).toMatchObject({ total: 12, result: "none" });
    const opposed = resolveThrow(freeInput({ characterId: "char-1", dice: [8, 10], redDice: [6, 12], redModifier: -1 }), gmContext(), scripted([1, 1, 6, 6]));
    expect(opposed.kind).toBe("opposed-check");
    expect(opposed.outcome.winner).toBe("second");
  });

  it("compares mixed or nonstandard dice as generic opposed rolls", () => {
    expect(resolveThrow(freeInput({ dice: [4, 20] }), gmContext(), scripted([4, 20])).kind).toBe("free");
    const input = parseCreateRequest({ sourceThrowId: null, setup: { type: "free", characterId: "gm", dice: [4, 20], modifier: 0, redDice: [6, 8], redModifier: 0, note: "" } });
    expect(resolveThrow(input, gmContext(), scripted([4, 20, 6, 8])).outcome).toMatchObject({ first: { total: 24, result: "none" }, second: { total: 14, result: "none" }, winner: "first" });
    expect(resolveThrow(freeInput({ dice: [8], redDice: [6, 12] }), gmContext(), scripted([7, 4, 8])).outcome).toMatchObject({ first: { total: 7, result: "none" }, second: { total: 12, result: "none" }, winner: "second" });
    expect(resolveThrow(freeInput({ dice: [6, 8], redDice: [20] }), gmContext(), scripted([3, 4, 10])).outcome).toMatchObject({ first: { total: 7, result: "none" }, second: { total: 10, result: "none" }, winner: "second" });
  });

  it("rolls a player free roll as their active character and rejects missing or foreign attribution", () => {
    const resolved = resolveThrow(freeInput({ characterId: "char-1" }), playerContext(), scripted([3]));
    expect(resolved.role).toBe("Player");
    expect(resolved.characterName).toBe("Hero");
    expectFailure(() => resolveThrow(freeInput({ characterId: "char-1" }), playerContext({ ownActiveCharacterId: null }), scripted([])), "no_active_character");
    expectFailure(() => resolveThrow(freeInput({ characterId: "char-1" }), playerContext({ membershipId: "member-2" }), scripted([])), "forbidden");
    expectFailure(() => resolveThrow(freeInput({ characterId: "gm" }), playerContext(), scripted([])), "forbidden");
  });
});

describe("roll permissions", () => {
  it("rejects stale revisions, inactive characters and cross-controller rolls", () => {
    expectFailure(() => resolveThrow(attributeInput({ expectedRevision: 2 }), gmContext(), scripted([])), "stale_revision");
    expectFailure(() => resolveThrow(attributeInput(), gmContext({ activeCharacterIds: [] }), scripted([])), "inactive_character");
    expectFailure(() => resolveThrow(attributeInput(), playerContext({ membershipId: "member-2" }), scripted([])), "forbidden");
    expectFailure(() => resolveThrow(attributeInput({ characterId: "other" }), gmContext({ character: character({ id: "other", playerId: null }) }), scripted([])), "inactive_character");
    expectFailure(() => resolveThrow(attributeInput({ characterId: "gone" }), gmContext({ character: null }), scripted([])), "not_found");
  });

  it("does not roll dice when character access, revision, or weapon validation fails", () => {
    const die = vi.fn(() => 1);
    expectFailure(() => resolveThrow(attributeInput({ expectedRevision: 2 }), gmContext(), die), "stale_revision");
    expectFailure(() => resolveThrow(attributeInput(), gmContext({ activeCharacterIds: [] }), die), "inactive_character");
    expectFailure(() => resolveThrow(weaponInput(), gmContext({ weapon: null }), die), "not_found");
    expectFailure(() => resolveThrow(freeInput({ characterId: "gm" }), playerContext(), die), "forbidden");
    expect(die).not.toHaveBeenCalled();
  });

  it("requires reroll setups to match the source kind and keep its character", () => {
    const source = { kind: "attribute-check" as ThrowKind, setup: { characterId: "char-1" } as ResolvedSetup, characterId: "char-1", equipmentId: null };
    expectFailure(() => resolveThrow(freeInput(), gmContext({ source }), scripted([])), "validation");
    expectFailure(() => resolveThrow(attributeInput({ characterId: "char-2" }), gmContext({ source, character: character({ id: "char-2" }), activeCharacterIds: ["char-1", "char-2"] }), scripted([])), "validation");
  });
});
