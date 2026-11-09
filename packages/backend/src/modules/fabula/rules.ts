import type {
  Attribute,
  FabulaSheet,
  SheetChanges,
  Contribution,
  CalculatedDefense,
  FabulaPreview,
  EquipmentEntry,
} from "./types.ts";

const attributes: Attribute[] = ["DEX", "INS", "MIG", "WLP"];
const dice = new Set([6, 8, 10, 12]);
const integer32 = (value: unknown) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= -2147483648 &&
  value <= 2147483647;
const nonNegative = (value: unknown) => integer32(value) && (value as number) >= 0;
const error = (message: string, field = "") =>
  Object.assign(new Error(message), {
    code: "validation",
    field: field ? `/${field.replaceAll(".", "/")}` : "",
  });
const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const exactKeys = (value: Record<string, unknown>, keys: string[], field: string) => {
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key)))
    throw error(`Unknown ${field} field`, field);
};

export function defaultSheet(name: string): FabulaSheet {
  return {
    name: name.trim(),
    theme: null,
    level: 5,
    baseDice: { DEX: 8, INS: 10, MIG: 6, WLP: 8 },
    classes: [],
    skills: [],
    equipment: [],
    resources: { hp: 35, mp: 45, ip: 6, fabula: 3 },
    overrides: {
      maxHp: null,
      maxMp: null,
      maxIp: null,
      defense: null,
      magicDefense: null,
      initiative: null,
    },
  };
}

function validateNamed(entries: unknown, label: string, max: number) {
  if (!Array.isArray(entries) || entries.length > max) throw error(`Invalid ${label}`, label);
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") throw error(`Invalid ${label}`, label);
    const value = entry as Record<string, unknown>;
    exactKeys(value, ["id", "name", "notes"], label);
    if (
      !uuid(value.id) ||
      ids.has(value.id as string) ||
      typeof value.name !== "string" ||
      !value.name.trim() ||
      value.name.length > 100 ||
      typeof value.notes !== "string" ||
      value.notes.length > 500
    )
      throw error(`Invalid ${label}`, label);
    ids.add(value.id as string);
  }
}

function validateEquipment(entries: unknown) {
  if (!Array.isArray(entries) || entries.length > 100)
    throw error("Invalid equipment", "equipment");
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") throw error("Invalid equipment", "equipment");
    const value = entry as Record<string, unknown>;
    if (
      typeof value.id !== "string" ||
      !uuid(value.id) ||
      ids.has(value.id) ||
      typeof value.name !== "string" ||
      !value.name.trim() ||
      value.name.length > 100 ||
      typeof value.notes !== "string" ||
      value.notes.length > 500 ||
      (value.priceZenit !== null && !nonNegative(value.priceZenit))
    )
      throw error("Invalid equipment", "equipment");
    ids.add(value.id);
    if (!["other", "weapon", "armor", "shield"].includes(String(value.kind)))
      throw error("Invalid equipment", "equipment");
    if (value.kind === "weapon") {
      exactKeys(
        value,
        ["id", "name", "notes", "priceZenit", "kind", "equipped", "accuracyDice", "accuracyBonus"],
        "equipment",
      );
      if (
        typeof value.equipped !== "boolean" ||
        !Array.isArray(value.accuracyDice) ||
        value.accuracyDice.length !== 2 ||
        value.accuracyDice.some((v) => v !== null && !attributes.includes(v as Attribute)) ||
        (value.accuracyBonus !== null && !integer32(value.accuracyBonus))
      )
        throw error("Invalid weapon", "equipment");
    }
    if (value.kind === "armor" || value.kind === "shield") {
      exactKeys(
        value,
        value.kind === "armor"
          ? [
              "id",
              "name",
              "notes",
              "priceZenit",
              "kind",
              "equipped",
              "fixedDefense",
              "defenseBonus",
              "magicDefenseBonus",
              "initiativeModifier",
            ]
          : [
              "id",
              "name",
              "notes",
              "priceZenit",
              "kind",
              "equipped",
              "defenseBonus",
              "magicDefenseBonus",
              "initiativeModifier",
            ],
        "equipment",
      );
      if (
        typeof value.equipped !== "boolean" ||
        !integer32(value.defenseBonus) ||
        !integer32(value.magicDefenseBonus) ||
        !integer32(value.initiativeModifier)
      )
        throw error("Invalid equipment modifiers", "equipment");
      if (value.kind === "armor" && value.fixedDefense !== null && !nonNegative(value.fixedDefense))
        throw error("Invalid armor", "equipment");
    }
    if (value.kind === "other")
      exactKeys(value, ["id", "name", "notes", "priceZenit", "kind"], "equipment");
  }
}

export function validateSheet(sheet: unknown): FabulaSheet {
  if (!sheet || typeof sheet !== "object") throw error("Invalid sheet");
  const value = sheet as Record<string, unknown>;
  exactKeys(
    value,
    [
      "name",
      "theme",
      "level",
      "baseDice",
      "classes",
      "skills",
      "equipment",
      "resources",
      "overrides",
    ],
    "sheet",
  );
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 100)
    throw error("Enter a character name", "name");
  if (value.theme !== null && (typeof value.theme !== "string" || value.theme.length > 200))
    throw error("Invalid theme", "theme");
  if (!integer32(value.level) || (value.level as number) < 5 || (value.level as number) > 50)
    throw error("Level must be between 5 and 50", "level");
  const baseDice = value.baseDice as Record<string, unknown>;
  if (baseDice && typeof baseDice === "object") exactKeys(baseDice, attributes, "baseDice");
  if (!baseDice || attributes.some((attribute) => !dice.has(baseDice[attribute] as number)))
    throw error("Invalid attribute dice", "baseDice");
  validateNamed(value.classes, "classes", 2);
  validateNamed(value.skills, "skills", 100);
  validateEquipment(value.equipment);
  const resources = value.resources as Record<string, unknown>;
  if (resources && typeof resources === "object")
    exactKeys(resources, ["hp", "mp", "ip", "fabula"], "resources");
  if (!resources || ["hp", "mp", "ip", "fabula"].some((key) => !nonNegative(resources[key])))
    throw error("Invalid resources", "resources");
  const overrides = value.overrides as Record<string, unknown>;
  if (overrides && typeof overrides === "object")
    exactKeys(
      overrides,
      ["maxHp", "maxMp", "maxIp", "defense", "magicDefense", "initiative"],
      "overrides",
    );
  if (
    !overrides ||
    ["maxHp", "maxMp", "maxIp"].some(
      (key) => overrides[key] !== null && !nonNegative(overrides[key]),
    ) ||
    ["defense", "magicDefense", "initiative"].some(
      (key) => overrides[key] !== null && !integer32(overrides[key]),
    )
  )
    throw error("Invalid overrides", "overrides");
  const normalized = structuredClone(sheet) as FabulaSheet;
  normalized.name = normalized.name.trim();
  normalized.theme = normalized.theme?.trim() || null;
  for (const entry of [...normalized.classes, ...normalized.skills, ...normalized.equipment])
    entry.name = entry.name.trim();
  return normalized;
}

export function mergeSheet(current: FabulaSheet, changes: SheetChanges): FabulaSheet {
  if (!changes || typeof changes !== "object" || Object.keys(changes).length === 0)
    throw error("At least one change is required");
  const allowed = new Set([
    "name",
    "theme",
    "level",
    "classes",
    "skills",
    "equipment",
    "baseDice",
    "resources",
    "overrides",
  ]);
  if (Object.keys(changes).some((key) => !allowed.has(key))) throw error("Unknown sheet field");
  const next = {
    ...current,
    ...changes,
    baseDice: { ...current.baseDice, ...changes.baseDice },
    resources: { ...current.resources, ...changes.resources },
    overrides: { ...current.overrides, ...changes.overrides },
  };
  return validateSheet(next);
}

function calculated(value: number, contributions: Contribution[]): CalculatedDefense {
  return { calculated: value, contributions };
}
export function preview(sheet: FabulaSheet): FabulaPreview {
  const maxima = {
    hp: sheet.level + 5 * sheet.baseDice.MIG,
    mp: sheet.level + 5 * sheet.baseDice.WLP,
    ip: 6,
  };
  const armor = sheet.equipment.filter(
    (entry): entry is Extract<EquipmentEntry, { kind: "armor" }> =>
      entry.kind === "armor" && entry.equipped,
  );
  const shields = sheet.equipment.filter(
    (entry): entry is Extract<EquipmentEntry, { kind: "shield" }> =>
      entry.kind === "shield" && entry.equipped,
  );
  const physical: CalculatedDefense =
    armor.length > 1 || shields.length > 1
      ? { calculated: null, reason: "ambiguous_equipment" }
      : calculated(
          (armor[0]?.fixedDefense ??
            sheet.baseDice.DEX + armor.reduce((sum, entry) => sum + entry.defenseBonus, 0)) +
            shields.reduce((sum, entry) => sum + entry.defenseBonus, 0),
          [
            ...(armor[0]?.fixedDefense === null || !armor[0]
              ? [{ source: "DEX" as const, value: sheet.baseDice.DEX }]
              : [{ source: "armor" as const, entryId: armor[0].id, value: armor[0].fixedDefense }]),
            ...armor
              .filter((entry) => entry.fixedDefense === null)
              .map((entry) => ({
                source: "armor" as const,
                entryId: entry.id,
                value: entry.defenseBonus,
              })),
            ...shields.map((entry) => ({
              source: "shield" as const,
              entryId: entry.id,
              value: entry.defenseBonus,
            })),
          ],
        );
  const magic: CalculatedDefense =
    armor.length > 1 || shields.length > 1
      ? { calculated: null, reason: "ambiguous_equipment" }
      : calculated(
          sheet.baseDice.INS +
            armor.reduce((sum, entry) => sum + entry.magicDefenseBonus, 0) +
            shields.reduce((sum, entry) => sum + entry.magicDefenseBonus, 0),
          [
            { source: "INS", value: sheet.baseDice.INS },
            ...armor.map((entry) => ({
              source: "armor" as const,
              entryId: entry.id,
              value: entry.magicDefenseBonus,
            })),
            ...shields.map((entry) => ({
              source: "shield" as const,
              entryId: entry.id,
              value: entry.magicDefenseBonus,
            })),
          ],
        );
  const initiative: CalculatedDefense =
    armor.length > 1 || shields.length > 1
      ? { calculated: null, reason: "ambiguous_equipment" }
      : calculated(
          armor.reduce((sum, entry) => sum + entry.initiativeModifier, 0) +
            shields.reduce((sum, entry) => sum + entry.initiativeModifier, 0),
          [
            ...armor.map((entry) => ({
              source: "armor" as const,
              entryId: entry.id,
              value: entry.initiativeModifier,
            })),
            ...shields.map((entry) => ({
              source: "shield" as const,
              entryId: entry.id,
              value: entry.initiativeModifier,
            })),
          ],
        );
  return {
    coverage: "partial",
    maxima,
    defenses: { defense: physical, magicDefense: magic, initiative },
  };
}
