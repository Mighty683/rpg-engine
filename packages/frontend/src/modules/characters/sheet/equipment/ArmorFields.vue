<script setup lang="ts">
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
      label="Physical Defense"
      class="col-span-full"
      :model-value="entry.armor.fixedDefense === null ? 'dex' : 'fixed'"
      :items="[
        { label: 'DEX + armor bonus', value: 'dex' },
        { label: 'Fixed armor Defense', value: 'fixed' },
      ]"
      :data-testid="`defense-mode-${entry.id}`"
      :aria-label="`Defense calculation for ${entry.name}`"
      @update:model-value="$emit('update', 'fixedDefense', $event === 'fixed' ? 0 : null)"
    />
    <p class="wide hint">
      {{
        entry.armor.fixedDefense === null
          ? "Armor bonus is added to DEX."
          : "Fixed armor Defense replaces DEX. Shield bonuses still apply."
      }}
    </p>
    <LabeledInput
      v-if="entry.armor.fixedDefense !== null"
      label="Fixed Defense"
      type="number"
      :data-testid="`fixed-defense-${entry.id}`"
      :aria-label="`Fixed Defense for ${entry.name}`"
      :model-value="entry.armor.fixedDefense"
      @input="$emit('update', 'fixedDefense', numericValue($event))"
    />
    <LabeledInput
      v-else
      label="DEX bonus"
      type="number"
      :aria-label="`DEX bonus for ${entry.name}`"
      :model-value="entry.armor.physicalBonus"
      @input="$emit('update', 'physicalBonus', numericValue($event))"
    />
    <LabeledInput
      label="Magic Defense bonus"
      type="number"
      :aria-label="`Magic Defense bonus for ${entry.name}`"
      :model-value="entry.armor.magicBonus"
      @input="$emit('update', 'magicBonus', numericValue($event))"
    />
    <p class="wide hint">Add the armor's Magic Defense bonus to INS.</p>
    <LabeledInput
      label="Initiative modifier"
      type="number"
      :aria-label="`Initiative modifier for ${entry.name}`"
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
