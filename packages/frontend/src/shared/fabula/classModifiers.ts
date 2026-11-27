import { tr } from "../i18n";
export const classModifierLabels = {
  maxHp: tr("ui.maximumHp"),
  maxMp: tr("ui.maximumMp"),
  maxIp: tr("ui.maximumIp"),
  defense: tr("ui.defense2"),
  magicDefense: tr("ui.magicDefense"),
  dieDex: tr("ui.dexDie"),
  dieIns: tr("ui.insDie"),
  dieMig: tr("ui.migDie"),
  dieWlp: tr("ui.wlpDie"),
} as const;

export type ClassModifierStat = keyof typeof classModifierLabels;

export function isClassModifierStat(stat: string): stat is ClassModifierStat {
  return Object.hasOwn(classModifierLabels, stat);
}

export function isDieModifier(stat: string): boolean {
  return stat.startsWith("die");
}
