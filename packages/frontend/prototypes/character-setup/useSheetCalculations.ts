import { computed, type ComputedRef } from "vue";
import type { Character } from "./types";
import { calculateDefense, calculateResourceMaximum } from "./sheetCalculations";

export function useSheetCalculations(character: ComputedRef<Character>) {
  const maximum = computed(() => calculateResourceMaximum(character.value));
  const defense = computed(() => calculateDefense(character.value));
  return {
    maximum,
    baseDefense: computed(() => defense.value.values),
    defenseDetails: computed(() => defense.value.details),
  };
}
