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
export interface ProgressionExperience {
  current: number;
  total: number;
}
export interface ProgressionCharacter {
  id: string;
  revision: number;
  levels: Record<string, number>;
  ranks: Record<string, number>;
  experience: ProgressionExperience;
  sheet: Sheet;
  party: PartyCharacter;
}
export interface ProgressionSnapshot {
  catalog: ProgressionClass[];
  characters: ProgressionCharacter[];
  party: PartyCharacter[];
}
export interface ProgressionSave extends ProgressionAllocation {
  expectedRevision: number;
}
export interface ProgressionApi {
  load(): Promise<ProgressionSnapshot>;
  create(id: string, name: string): Promise<void>;
  save(base: ProgressionCharacter, input: ProgressionSave): Promise<ProgressionCharacter>;
}
export interface SourcedBenefit extends ProgressionBenefit {
  source: string;
  rank: number;
  maxRank: number;
  isFree: boolean;
  total: number;
}

export interface ProgressionAllocation {
  level: number;
  ranks: Record<string, number>;
  levels: Record<string, number>;
  experience: ProgressionExperience;
}

export type ManagedProgression = {
  experience: ProgressionExperience;
  classLevels: { gameClassId: string; level: number }[];
  skillRanks: { skillId: string; rank: number }[];
};
export type ManagedAbilities = Pick<ProgressionCharacter, "experience" | "levels" | "ranks">;
