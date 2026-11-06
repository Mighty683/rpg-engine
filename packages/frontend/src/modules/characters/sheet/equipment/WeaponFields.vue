<script setup lang="ts">
import type { Attribute, NamedEntry } from "../types";
defineProps<{ entry: NamedEntry }>();
defineEmits<{
  equipped: [value: boolean];
  attribute: [index: 0 | 1, value: Attribute | ""];
  accuracy: [value: number | null];
}>();
</script>
<template>
  <label v-if="entry.itemType === 'weapon' && entry.weapon" class="weapon-equipped"
    ><input
      :checked="entry.weapon.equipped"
      @change="$emit('equipped', ($event.target as HTMLInputElement).checked)"
      type="checkbox"
      :data-testid="`equip-weapon-${entry.id}`"
      :aria-label="`Equip ${entry.name}`"
    />
    Equipped</label
  >
  <div v-if="entry.itemType === 'weapon' && entry.weapon" class="weapon-fields">
    <label v-for="index in [0, 1] as const" :key="index"
      >Attribute {{ index + 1
      }}<select
        :value="entry.weapon.attributes[index]"
        @change="
          $emit('attribute', index, ($event.target as HTMLSelectElement).value as Attribute | '')
        "
        :aria-label="`Weapon attribute ${index + 1} for ${entry.name}`"
        :data-testid="`weapon-attribute-${index + 1}`"
      >
        <option value="">Select</option>
        <option value="DEX">DEX</option>
        <option value="INS">INS</option>
        <option value="MIG">MIG</option>
        <option value="WLP">WLP</option>
      </select></label
    >
    <label
      >Accuracy bonus<input
        :value="entry.weapon.accuracyBonus"
        type="number"
        :aria-label="`Accuracy bonus for ${entry.name}`"
        data-testid="weapon-accuracy-bonus"
        placeholder="—"
        @input="
          $emit(
            'accuracy',
            ($event.target as HTMLInputElement).value === ''
              ? null
              : ($event.target as HTMLInputElement).valueAsNumber,
          )
        "
    /></label>
  </div>
</template>
<style scoped>
.weapon-fields input,
.weapon-fields select {
  display: block;
  width: 100%;
  min-width: 0;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  color: var(--ui-text);
  padding: var(--spacing-small);
  font-size: 0.875rem;
}
.weapon-equipped {
  display: flex;
  align-items: center;
  gap: var(--spacing-small);
  margin-top: var(--spacing-small);
}
.weapon-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-small);
  margin-top: var(--spacing-small);
}
.weapon-fields label {
  min-width: 0;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
</style>
