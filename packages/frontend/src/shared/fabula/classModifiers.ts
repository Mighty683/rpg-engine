export const classModifierLabels = {
  maxHp: "Maximum HP",
  maxMp: "Maximum MP",
  maxIp: "Maximum IP",
  defense: "Defense",
  magicDefense: "Magic Defense",
  dieDex: "DEX die",
  dieIns: "INS die",
  dieMig: "MIG die",
  dieWlp: "WLP die",
} as const;

export type ClassModifierStat = keyof typeof classModifierLabels;

export function isClassModifierStat(stat: string): stat is ClassModifierStat {
  return Object.hasOwn(classModifierLabels, stat);
}

export function isDieModifier(stat: string): boolean {
  return stat.startsWith("die");
}
