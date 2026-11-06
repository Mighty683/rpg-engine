import { describe, expect, it } from "vite-plus/test";
import { defaultSheet, mergeSheet, preview, validateSheet, type EquipmentEntry } from "./rules.ts";

describe("Fabula manual sheet rules", () => {
  it("creates the documented level-five defaults and partial maxima", () => {
    const sheet = defaultSheet(" Camilla ");
    expect(sheet).toMatchObject({
      name: "Camilla",
      level: 5,
      baseDice: { DEX: 8, INS: 10, MIG: 6, WLP: 8 },
      resources: { hp: 35, mp: 45, ip: 6, fabula: 3 },
    });
    expect(preview(sheet).maxima).toEqual({ hp: 35, mp: 45, ip: 6 });
  });

  it("merges nested maps while preserving omitted values and rejects invalid changes", () => {
    const sheet = defaultSheet("A");
    expect(mergeSheet(sheet, { resources: { hp: 99 } })).toMatchObject({
      resources: { hp: 99, mp: 45, ip: 6, fabula: 3 },
    });
    expect(() => mergeSheet(sheet, {})).toThrow();
    expect(() => validateSheet({ ...sheet, level: 4 })).toThrow();
    expect(() => validateSheet({ ...sheet, baseDice: { ...sheet.baseDice, DEX: 7 } })).toThrow();
    expect(() =>
      validateSheet({
        ...sheet,
        classes: [
          { id: "00000000-0000-4000-8000-000000000001", name: "A", notes: "" },
          { id: "00000000-0000-4000-8000-000000000002", name: "B", notes: "" },
          { id: "00000000-0000-4000-8000-000000000003", name: "C", notes: "" },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateSheet({ ...sheet, resources: { ...sheet.resources, hp: 1, extra: 2 } }),
    ).toThrow();
  });

  it("marks all defenses unavailable when armor or shields are ambiguous", () => {
    const armor = (id: string): EquipmentEntry => ({
      id,
      name: id,
      notes: "",
      priceZenit: null,
      kind: "armor",
      equipped: true,
      fixedDefense: 10,
      defenseBonus: 1,
      magicDefenseBonus: 2,
      initiativeModifier: -1,
    });
    const sheet = validateSheet({
      ...defaultSheet("A"),
      equipment: [
        armor("00000000-0000-4000-8000-000000000001"),
        armor("00000000-0000-4000-8000-000000000002"),
      ],
    });
    const result = preview(sheet);
    expect(result.defenses.defense).toEqual({ calculated: null, reason: "ambiguous_equipment" });
    expect(result.defenses.initiative).toEqual({ calculated: null, reason: "ambiguous_equipment" });
    expect(result.defenses.magicDefense).toEqual({
      calculated: null,
      reason: "ambiguous_equipment",
    });
  });

  it("applies fixed armor, shield bonuses, negative initiative, and keeps calculated previews under overrides", () => {
    const armor: EquipmentEntry = {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Armor",
      notes: "",
      priceZenit: null,
      kind: "armor",
      equipped: true,
      fixedDefense: 10,
      defenseBonus: 2,
      magicDefenseBonus: 3,
      initiativeModifier: -2,
    };
    const shield: EquipmentEntry = {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Shield",
      notes: "",
      priceZenit: null,
      kind: "shield",
      equipped: true,
      defenseBonus: 1,
      magicDefenseBonus: 2,
      initiativeModifier: 1,
    };
    const sheet = validateSheet({
      ...defaultSheet("A"),
      equipment: [armor, shield],
      overrides: {
        maxHp: null,
        maxMp: null,
        maxIp: null,
        defense: 99,
        magicDefense: 98,
        initiative: 97,
      },
    });
    const result = preview(sheet);
    expect(result.defenses.defense).toEqual({
      calculated: 11,
      contributions: [
        { source: "armor", entryId: armor.id, value: 10 },
        { source: "shield", entryId: shield.id, value: 1 },
      ],
    });
    expect(result.defenses.magicDefense).toMatchObject({ calculated: 15 });
    expect(result.defenses.initiative).toMatchObject({ calculated: -1 });
    const dexBased = preview({
      ...sheet,
      equipment: [{ ...armor, fixedDefense: null }, shield],
    });
    expect(dexBased.defenses.defense).toMatchObject({ calculated: 11 });
    const fixedTwo = preview({ ...sheet, equipment: [{ ...armor, fixedDefense: 2 }] });
    expect(fixedTwo.defenses.defense).toMatchObject({ calculated: 2 });
  });
});
