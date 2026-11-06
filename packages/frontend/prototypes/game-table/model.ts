export const attributes = ["DEX", "INS", "MIG", "WLP"] as const;
export const dieSizes = [6, 8, 10, 12] as const;
export type Attribute = (typeof attributes)[number];
export type DieSize = (typeof dieSizes)[number];
export type Resource = { current: number; max: number };

export type PartyMember = {
  id: string;
  name: string;
  controller: string;
  hp: Resource;
  mp: Resource;
  ip: Resource;
  fabula: number;
  baseDice: Record<Attribute, DieSize>;
};

export type CheckDraft = {
  first: Attribute;
  second: Attribute;
  dice: Record<Attribute, DieSize>;
  modifier: number | undefined;
  difficulty: number | undefined;
};

export type CheckResult = {
  character: string;
  dice: readonly [CheckDie, CheckDie];
  modifier: number;
  difficulty: number;
  total: number;
  outcome: "Fumble" | "Critical success" | "Success" | "Failure";
};

type CheckDie = { attribute: Attribute; size: DieSize; face: number };

export function startCheck(member: PartyMember): CheckDraft {
  return { first: "DEX", second: "INS", dice: { ...member.baseDice }, modifier: 0, difficulty: 10 };
}

export function rollCheck(
  character: string,
  draft: CheckDraft,
  modifier: number,
  difficulty: number,
): CheckResult {
  function roll(attribute: Attribute): CheckDie {
    const size = draft.dice[attribute];
    return { attribute, size, face: Math.floor(Math.random() * size) + 1 };
  }
  const first = roll(draft.first);
  const second = roll(draft.second);
  const total = first.face + second.face + modifier;
  let outcome: CheckResult["outcome"] = total >= difficulty ? "Success" : "Failure";
  if (first.face === 1 && second.face === 1) outcome = "Fumble";
  if (first.face === second.face && first.face >= 6) outcome = "Critical success";
  return { character, dice: [first, second], modifier, difficulty, total, outcome };
}
