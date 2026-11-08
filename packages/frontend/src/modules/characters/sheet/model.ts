import type { Equipment, Sheet, Character, NamedEntry } from "./types";

function toEntry(entry: Equipment): NamedEntry {
  const base: NamedEntry = {
    id: entry.id,
    name: entry.name,
    notes: entry.notes,
    price: entry.priceZenit,
  };
  if (entry.kind === "weapon")
    return {
      ...base,
      itemType: "weapon",
      weapon: {
        attributes: [entry.accuracyDice?.[0] ?? "", entry.accuracyDice?.[1] ?? ""],
        accuracyBonus: entry.accuracyBonus ?? null,
        equipped: entry.equipped,
      },
    };
  if (entry.kind === "other") return { ...base, itemType: "other" };
  const defense = {
    physicalBonus: entry.defenseBonus ?? 0,
    magicBonus: entry.magicDefenseBonus ?? 0,
    initiative: entry.initiativeModifier ?? 0,
  };
  return {
    ...base,
    itemType: "armor",
    defenseKind: entry.kind,
    equipped: entry.equipped,
    ...(entry.kind === "armor"
      ? { armor: { ...defense, fixedDefense: entry.fixedDefense ?? null } }
      : { shield: defense }),
  };
}

function toEquipment(entry: NamedEntry): Equipment {
  const base = { id: entry.id, name: entry.name, notes: entry.notes, priceZenit: entry.price };
  if (entry.itemType === "weapon")
    return {
      ...base,
      kind: "weapon",
      equipped: !!entry.weapon?.equipped,
      accuracyDice: [entry.weapon?.attributes[0] || null, entry.weapon?.attributes[1] || null],
      accuracyBonus: entry.weapon?.accuracyBonus ?? null,
    };
  if (entry.itemType === "armor" && entry.defenseKind) {
    const defense = entry.defenseKind === "armor" ? entry.armor : entry.shield;
    return {
      ...base,
      kind: entry.defenseKind,
      equipped: !!entry.equipped,
      defenseBonus: defense?.physicalBonus ?? 0,
      magicDefenseBonus: defense?.magicBonus ?? 0,
      initiativeModifier: defense?.initiative ?? 0,
      ...(entry.defenseKind === "armor" ? { fixedDefense: entry.armor?.fixedDefense ?? null } : {}),
    };
  }
  return { ...base, kind: "other" };
}

export function toCharacter(sheet: Sheet, id: string, locked: boolean): Character {
  return {
    id,
    identity: { name: sheet.name, theme: sheet.theme ?? "" },
    level: sheet.level,
    editingLocked: locked,
    attributes: {
      DEX: String(sheet.baseDice.DEX),
      INS: String(sheet.baseDice.INS),
      MIG: String(sheet.baseDice.MIG),
      WLP: String(sheet.baseDice.WLP),
    },
    classes: sheet.classes.map((entry) => ({ ...entry, price: null })),
    skills: sheet.skills.map((entry) => ({ ...entry, price: null })),
    equipment: sheet.equipment.map(toEntry),
    current: {
      HP: sheet.resources.hp,
      MP: sheet.resources.mp,
      IP: sheet.resources.ip,
      Fabula: sheet.resources.fabula,
    },
    overrides: {
      DEF: sheet.overrides.defense,
      "MAG DEF": sheet.overrides.magicDefense,
      INIT: sheet.overrides.initiative,
    },
  };
}

export function toSheet(character: Character, original: Sheet): Sheet {
  const entries = (values: NamedEntry[]) =>
    values.map(({ id, name, notes }) => ({ id, name, notes }));
  return {
    ...original,
    name: character.identity.name,
    theme: character.identity.theme || null,
    level: character.level,
    baseDice: {
      DEX: Number(character.attributes.DEX),
      INS: Number(character.attributes.INS),
      MIG: Number(character.attributes.MIG),
      WLP: Number(character.attributes.WLP),
    },
    classes: entries(character.classes),
    skills: entries(character.skills),
    equipment: character.equipment.map(toEquipment),
    resources: {
      hp: character.current.HP ?? original.resources.hp,
      mp: character.current.MP ?? original.resources.mp,
      ip: character.current.IP ?? original.resources.ip,
      fabula: character.current.Fabula,
    },
    overrides: {
      ...original.overrides,
      defense: character.overrides.DEF,
      magicDefense: character.overrides["MAG DEF"],
      initiative: character.overrides.INIT,
    },
  };
}
