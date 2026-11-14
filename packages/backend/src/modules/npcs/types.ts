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

export type CreateNpcInput = { id: string; npc: NpcWrite };
export type UpdateNpcInput = { expectedRevision: number; npc: NpcWrite };
export type RemoveNpcInput = { expectedRevision: number };
