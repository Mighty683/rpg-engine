<script setup lang="ts">
import type { Stat } from "../types";

import SheetSection from "../../../../shared/design-system/SheetSection.vue";
import DefenseField from "./DefenseField.vue";
import type { Character } from "../types";

defineProps<{
  overrides: Character["overrides"];
  calculated: Record<Stat, number | null>;
  details: Record<Stat, { name: string; value: number; modifier?: boolean }[]>;
}>();
const help = {
  DEF: "Defense is the difficulty for attacks targeting physical Defense.",
  "MAG DEF": "Magic Defense is the difficulty for effects targeting Magic Defense.",
  INIT: "Initiative modifies checks to determine turn order.",
};
</script>

<template>
  <SheetSection
    ><template #heading>⬡ DEFENSE</template><template #hint>BASE / OVERRIDE</template>
    <div class="grid">
      <div class="defense-card">
        <DefenseField
          v-for="stat in ['DEF', 'MAG DEF'] as const"
          :key="stat"
          v-model="overrides[stat]"
          :label="stat"
          :help="help[stat]"
          :calculated="calculated[stat]"
          :contributions="details[stat]"
          compact
        />
      </div>
      <DefenseField
        v-model="overrides.INIT"
        label="INIT"
        :help="help.INIT"
        :calculated="calculated.INIT"
        :contributions="details.INIT"
      />
    </div>
    <p class="note">Skill and other effects are not included.</p></SheetSection
  >
</template>

<style scoped>
.grid {
  display: grid;
  gap: var(--spacing-small);
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
}
.defense-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-small);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  padding: var(--sheet-tight) var(--spacing-small);
}
.note {
  font-size: var(--sheet-label-size);
  color: var(--ui-text-muted);
}
</style>
