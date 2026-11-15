import type { ClassModifierStat } from "../../shared/fabula/classModifiers";
import type { Sheet } from "../characters/sheet/types";
import type { PartyCharacter } from "../game-table/types";

export interface ProgressionBenefit {
  id: string;
  name: string;
  description: string;
  stat?: ClassModifierStat;
  amount?: number;
  perRank?: boolean;
}
export interface ProgressionSkill {
  id: string;
  name: string;
  description: string;
  maxRank: number;
  benefits: ProgressionBenefit[];
}
export interface ProgressionClass {
  id: string;
  name: string;
  description: string;
  benefits: ProgressionBenefit[];
  skills: ProgressionSkill[];
}
export interface ProgressionCharacter {
  id: string;
  revision: number;
  levels: Record<string, number>;
  ranks: Record<string, number>;
  sheet: Sheet;
  party: PartyCharacter;
}
export interface ProgressionSnapshot {
  catalog: ProgressionClass[];
  characters: ProgressionCharacter[];
}
export interface ProgressionSave {
  expectedRevision: number;
  levels: Record<string, number>;
  ranks: Record<string, number>;
}
export interface ProgressionApi {
  load(): Promise<ProgressionSnapshot>;
  save(id: string, input: ProgressionSave): Promise<ProgressionSnapshot>;
}
export interface SourcedBenefit extends ProgressionBenefit {
  source: string;
  rank: number;
  maxRank: number;
  isFree: boolean;
  total: number;
}

export interface ProgressionAllocation {
  ranks: Record<string, number>;
  levels: Record<string, number>;
}
