<script setup lang="ts">
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
      label="Defense bonus"
      type="number"
      :aria-label="`Defense bonus for ${entry.name}`"
      :model-value="entry.shield.physicalBonus"
      @input="$emit('update', 'physicalBonus', numericValue($event))"
    />
    <LabeledInput
      label="Magic Defense bonus"
      type="number"
      :aria-label="`Magic Defense bonus for ${entry.name}`"
      :model-value="entry.shield.magicBonus"
      @input="$emit('update', 'magicBonus', numericValue($event))"
    />
    <LabeledInput
      label="Initiative modifier"
      type="number"
      :aria-label="`Initiative modifier for ${entry.name}`"
      :model-value="entry.shield.initiative"
      @input="$emit('update', 'initiative', numericValue($event))"
    />
  </EditorFieldGrid>
</template>
