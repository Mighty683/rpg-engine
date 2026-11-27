<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
import type { Stat } from "../types";

import SheetSection from "../../../../shared/design-system/domain/SheetSection.vue";
import DefenseField from "./DefenseField.vue";
import type { Character } from "../types";

defineProps<{
  includesClassEffects?: boolean;
  overrides: Character["overrides"];
  calculated: Record<Stat, number | null>;
  details: Record<Stat, { name: string; value: number; modifier?: boolean }[]>;
}>();
const help = {
  DEF: tr("ui.defenseIsTheDifficultyForAttacksTargetingPhysicalDefense"),
  "MAG DEF": tr("ui.magicDefenseIsTheDifficultyForEffectsTargetingMagic"),
  INIT: tr("ui.initiativeModifiesChecksToDetermineTurnOrder"),
};
</script>

<template>
  <SheetSection
    ><template #heading>{{ tr("ui.defense") }}</template
    ><template #hint>{{ tr("ui.baseOverride") }}</template>
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
        :label="tr('ui.init')"
        :help="help.INIT"
        :calculated="calculated.INIT"
        :contributions="details.INIT"
      />
    </div>
    <p v-if="!includesClassEffects" class="note">
      {{ tr("ui.skillAndOtherEffectsAreNotIncluded") }}
    </p></SheetSection
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
  padding: var(--sheet-field-padding);
}
.note {
  font-size: var(--sheet-label-size);
  color: var(--ui-text-muted);
}
</style>
