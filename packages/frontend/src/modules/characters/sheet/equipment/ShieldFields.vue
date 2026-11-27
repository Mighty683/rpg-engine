<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
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
  <EditorFieldGrid v-if="entry.defenseKind === 'shield' && entry.shield" class="mt-small">
    <LabeledInput
      :label="tr('ui.defenseBonus')"
      type="number"
      :aria-label="tr('ui.defenseBonusForValue1', { value1: entry.name })"
      :model-value="entry.shield.physicalBonus"
      @input="$emit('update', 'physicalBonus', numericValue($event))"
    />
    <LabeledInput
      :label="tr('ui.magicDefenseBonus')"
      type="number"
      :aria-label="tr('ui.magicDefenseBonusForValue1', { value1: entry.name })"
      :model-value="entry.shield.magicBonus"
      @input="$emit('update', 'magicBonus', numericValue($event))"
    />
    <LabeledInput
      :label="tr('ui.initiativeModifier')"
      type="number"
      :aria-label="tr('ui.initiativeModifierForValue1', { value1: entry.name })"
      :model-value="entry.shield.initiative"
      @input="$emit('update', 'initiative', numericValue($event))"
    />
  </EditorFieldGrid>
</template>
