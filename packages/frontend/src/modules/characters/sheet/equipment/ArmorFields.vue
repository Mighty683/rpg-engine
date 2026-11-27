<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
import LabeledSelect from "../../../../shared/design-system/base/LabeledSelect.vue";
import EditorFieldGrid from "../../../../shared/design-system/base/EditorFieldGrid.vue";
import LabeledInput from "../../../../shared/design-system/base/LabeledInput.vue";
import type { NamedEntry } from "../types";
defineProps<{ entry: NamedEntry }>();
defineEmits<{ update: [field: string, value: number | null] }>();
function numericValue(event: Event): number {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  return Number.isFinite(value) ? value : 0;
}
</script>
<template>
  <EditorFieldGrid v-if="entry.defenseKind === 'armor' && entry.armor" class="mt-small">
    <LabeledSelect
      :label="tr('ui.physicalDefense')"
      class="col-span-full"
      :model-value="entry.armor.fixedDefense === null ? 'dex' : 'fixed'"
      :items="[
        { label: tr('ui.dexArmorBonus'), value: 'dex' },
        { label: tr('ui.fixedArmorDefense'), value: 'fixed' },
      ]"
      :data-testid="`defense-mode-${entry.id}`"
      :aria-label="tr('ui.defenseCalculationForValue1', { value1: entry.name })"
      @update:model-value="$emit('update', 'fixedDefense', $event === 'fixed' ? 0 : null)"
    />
    <p class="wide hint">
      {{
        entry.armor.fixedDefense === null
          ? tr("ui.armorBonusIsAddedToDex")
          : tr("ui.fixedArmorDefenseReplacesDexShieldBonusesStillApply")
      }}
    </p>
    <LabeledInput
      v-if="entry.armor.fixedDefense !== null"
      :label="tr('ui.fixedDefense')"
      type="number"
      :data-testid="`fixed-defense-${entry.id}`"
      :aria-label="tr('ui.fixedDefenseForValue1', { value1: entry.name })"
      :model-value="entry.armor.fixedDefense"
      @input="$emit('update', 'fixedDefense', numericValue($event))"
    />
    <LabeledInput
      v-else
      :label="tr('ui.dexBonus')"
      type="number"
      :aria-label="tr('ui.dexBonusForValue1', { value1: entry.name })"
      :model-value="entry.armor.physicalBonus"
      @input="$emit('update', 'physicalBonus', numericValue($event))"
    />
    <LabeledInput
      :label="tr('ui.magicDefenseBonus')"
      type="number"
      :aria-label="tr('ui.magicDefenseBonusForValue1', { value1: entry.name })"
      :model-value="entry.armor.magicBonus"
      @input="$emit('update', 'magicBonus', numericValue($event))"
    />
    <p class="wide hint">{{ tr("ui.addTheArmorSMagicDefenseBonusToIns") }}</p>
    <LabeledInput
      :label="tr('ui.initiativeModifier')"
      type="number"
      :aria-label="tr('ui.initiativeModifierForValue1', { value1: entry.name })"
      :model-value="entry.armor.initiative"
      @input="$emit('update', 'initiative', numericValue($event))"
    />
  </EditorFieldGrid>
</template>
<style scoped>
.wide {
  grid-column: 1 / -1;
}
.hint {
  color: var(--ui-text-muted);
  font-size: var(--text-label);
}
</style>
