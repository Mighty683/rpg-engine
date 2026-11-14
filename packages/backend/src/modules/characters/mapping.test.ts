import { expect, it } from "vite-plus/test";
import { assembleSheet, equipmentFromRow, equipmentToRow } from "./mapping.ts";
import type { EquipmentRow, Row } from "./types.ts";
import type { EquipmentEntry } from "../fabula/types.ts";

const equipmentRow: EquipmentRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  character_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Equipment",
  notes: "Notes",
  position: 1,
  kind: "other",
  price_zenit: null,
  equipped: null,
  accuracy_attribute_1: null,
  accuracy_attribute_2: null,
  accuracy_bonus: null,
  fixed_defense: null,
  defense_bonus: null,
  magic_defense_bonus: null,
  initiative_modifier: null,
};
const common = {
  id: equipmentRow.id,
  name: equipmentRow.name,
  notes: equipmentRow.notes,
  priceZenit: null,
};

it.each([
  { row: equipmentRow, entry: { ...common, kind: "other" } },
  {
    row: {
      ...equipmentRow,
      kind: "weapon",
      equipped: true,
      accuracy_attribute_1: "DEX",
      accuracy_attribute_2: "MIG",
      accuracy_bonus: -2,
    },
    entry: {
      ...common,
      kind: "weapon",
      equipped: true,
      accuracyDice: ["DEX", "MIG"],
      accuracyBonus: -2,
    },
  },
  {
    row: { ...equipmentRow, kind: "weapon", equipped: false },
    entry: {
      ...common,
      kind: "weapon",
      equipped: false,
      accuracyDice: [null, null],
      accuracyBonus: null,
    },
  },
  {
    row: {
      ...equipmentRow,
      kind: "armor",
      equipped: true,
      fixed_defense: 12,
      defense_bonus: 0,
      magic_defense_bonus: 1,
      initiative_modifier: -2,
    },
    entry: {
      ...common,
      kind: "armor",
      equipped: true,
      fixedDefense: 12,
      defenseBonus: 0,
      magicDefenseBonus: 1,
      initiativeModifier: -2,
    },
  },
  {
    row: {
      ...equipmentRow,
      kind: "shield",
      equipped: false,
      defense_bonus: 2,
      magic_defense_bonus: -1,
      initiative_modifier: 0,
    },
    entry: {
      ...common,
      kind: "shield",
      equipped: false,
      defenseBonus: 2,
      magicDefenseBonus: -1,
      initiativeModifier: 0,
    },
  },
] satisfies { row: EquipmentRow; entry: EquipmentEntry }[])(
  "maps $entry.kind in both directions without mutating inputs",
  ({ row, entry }) => {
    const original = structuredClone({ row, entry });
    expect(equipmentFromRow(row)).toEqual(entry);
    expect(equipmentToRow(row.character_id, row.position, entry)).toEqual({
      id: row.id,
      characterId: row.character_id,
      position: row.position,
      name: row.name,
      notes: row.notes,
      kind: row.kind,
      priceZenit: row.price_zenit,
      equipped: row.equipped,
      accuracyAttribute1: row.accuracy_attribute_1,
      accuracyAttribute2: row.accuracy_attribute_2,
      accuracyBonus: row.accuracy_bonus,
      fixedDefense: row.fixed_defense,
      defenseBonus: row.defense_bonus,
      magicDefenseBonus: row.magic_defense_bonus,
      initiativeModifier: row.initiative_modifier,
    });
    expect({ row, entry }).toEqual(original);
  },
);

it("normalizes nullable armor modifiers, retains zero price, and rejects corrupt persisted discriminants", () => {
  expect(equipmentFromRow({ ...equipmentRow, kind: "armor", price_zenit: 0 })).toEqual({
    ...common,
    priceZenit: 0,
    kind: "armor",
    equipped: false,
    fixedDefense: null,
    defenseBonus: 0,
    magicDefenseBonus: 0,
    initiativeModifier: 0,
  });
  expect(() => equipmentFromRow({ ...equipmentRow, kind: "unknown" })).toThrow("unknown kind");
  expect(() =>
    equipmentFromRow({ ...equipmentRow, kind: "weapon", accuracy_attribute_1: "unknown" }),
  ).toThrow("unknown attribute");
});

it("assembles complete sheets with ordered collections and explicit null/zero overrides", () => {
  const row: Row = {
    id: equipmentRow.character_id,
    player_id: null,
    name: "Hero",
    theme: null,
    level: 5,
    dex_die: 8,
    ins_die: 10,
    mig_die: 6,
    wlp_die: 8,
    current_hp: 20,
    current_mp: 7,
    current_ip: 3,
    fabula_points: 2,
    max_hp_override: 80,
    max_mp_override: null,
    max_ip_override: 9,
    defense_override: 0,
    magic_defense_override: null,
    initiative_override: -3,
    revision: 1,
    created_at: new Date(0),
    updated_at: new Date(0),
  };
  const classes = [
    { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Second alphabetically", notes: "first" },
    { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "First alphabetically", notes: "second" },
  ];
  const skills = [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", name: "Skill", notes: "saved" }];
  const sheet = assembleSheet(row, { classes, skills, equipment: [equipmentRow] });
  expect(sheet).toEqual({
    name: "Hero",
    theme: null,
    level: 5,
    baseDice: { DEX: 8, INS: 10, MIG: 6, WLP: 8 },
    classes,
    skills,
    equipment: [{ ...common, kind: "other" }],
    resources: { hp: 20, mp: 7, ip: 3, fabula: 2 },
    overrides: { maxHp: 80, maxMp: null, maxIp: 9, defense: 0, magicDefense: null, initiative: -3 },
  });
  expect(assembleSheet(row, { classes: [], skills: [], equipment: [] }).equipment).toEqual([]);
});
