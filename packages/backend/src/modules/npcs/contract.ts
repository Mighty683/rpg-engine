export type Attribute = "DEX" | "INS" | "MIG" | "WLP";
export type Die = 6 | 8 | 10 | 12;
export type NpcAttack = {
  id: string;
  name: string;
  reach: "melee" | "ranged";
  attributes: [Attribute, Attribute];
  damageBonus: number;
  damageType: string;
};
export type NpcWrite = {
  name: string;
  relationship: "enemy" | "neutral" | "friend";
  level: number;
  visibility: "hidden" | "visible" | "known";
  baseDice: Record<Attribute, Die>;
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  defense: number;
  magicDefense: number;
  attacks: NpcAttack[];
  notes: string;
};

const attributes = ["DEX", "INS", "MIG", "WLP"] as const;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (field: string): never => {
  throw Object.assign(new Error("Invalid value."), { code: "validation", field });
};
function object(value: unknown, keys: readonly string[], field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(field);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some((key) => !(key in record)))
    return fail(field);
  return record;
}
function string(value: unknown, max: number, field: string, required = false): string {
  if (
    typeof value !== "string" ||
    Array.from(required ? value.trim() : value).length > max ||
    (required && !value.trim())
  )
    return fail(field);
  return required ? value.trim() : value;
}
function integer(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
    return fail(field);
  return value;
}
function choice<T extends string | number>(
  value: unknown,
  options: readonly T[],
  field: string,
): T {
  if (!options.includes(value as T)) return fail(field);
  return value as T;
}
function resource(value: unknown, field: string) {
  const item = object(value, ["current", "max"], field);
  const max = integer(item.max, 0, 2147483647, `${field}.max`);
  return { current: integer(item.current, 0, max, `${field}.current`), max };
}
function attack(value: unknown, index: number): NpcAttack {
  const field = `attacks.${index}`;
  const item = object(
    value,
    ["id", "name", "reach", "attributes", "damageBonus", "damageType"],
    field,
  );
  if (typeof item.id !== "string" || !idPattern.test(item.id)) return fail(`${field}.id`);
  if (!Array.isArray(item.attributes) || item.attributes.length !== 2)
    return fail(`${field}.attributes`);
  return {
    id: item.id.toLowerCase(),
    name: string(item.name, 100, `${field}.name`, true),
    reach: choice(item.reach, ["melee", "ranged"], `${field}.reach`),
    attributes: [
      choice(item.attributes[0], attributes, `${field}.attributes.0`),
      choice(item.attributes[1], attributes, `${field}.attributes.1`),
    ],
    damageBonus: integer(item.damageBonus, -2147483648, 2147483647, `${field}.damageBonus`),
    damageType: string(item.damageType, 100, `${field}.damageType`),
  };
}

/** Validate and normalize the complete replacement profile at the API boundary. */
export function parseNpcWrite(value: unknown): NpcWrite {
  const item = object(
    value,
    [
      "name",
      "relationship",
      "level",
      "visibility",
      "baseDice",
      "hp",
      "mp",
      "defense",
      "magicDefense",
      "attacks",
      "notes",
    ],
    "npc",
  );
  const dice = object(item.baseDice, attributes, "baseDice");
  if (!Array.isArray(item.attacks) || item.attacks.length > 100) return fail("attacks");
  const attacks = item.attacks.map(attack);
  if (new Set(attacks.map((entry) => entry.id)).size !== attacks.length) return fail("attacks");
  return {
    name: string(item.name, 100, "name", true),
    relationship: choice(item.relationship, ["enemy", "neutral", "friend"], "relationship"),
    level: integer(item.level, 5, 60, "level"),
    visibility: choice(item.visibility, ["hidden", "visible", "known"], "visibility"),
    baseDice: {
      DEX: choice(dice.DEX, [6, 8, 10, 12], "baseDice.DEX"),
      INS: choice(dice.INS, [6, 8, 10, 12], "baseDice.INS"),
      MIG: choice(dice.MIG, [6, 8, 10, 12], "baseDice.MIG"),
      WLP: choice(dice.WLP, [6, 8, 10, 12], "baseDice.WLP"),
    },
    hp: resource(item.hp, "hp"),
    mp: resource(item.mp, "mp"),
    defense: integer(item.defense, 0, 2147483647, "defense"),
    magicDefense: integer(item.magicDefense, 0, 2147483647, "magicDefense"),
    attacks,
    notes: string(item.notes, 2000, "notes"),
  };
}
