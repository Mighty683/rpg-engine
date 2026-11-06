<script setup lang="ts">
import type { NamedEntry } from "../types";
defineProps<{ entry: NamedEntry }>();
defineEmits<{ update: [field: string, value: number | null] }>();
function numericValue(event: Event): number {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  return Number.isFinite(value) ? value : 0;
}
</script>
<template>
  <div v-if="entry.defenseKind === 'shield' && entry.shield" class="fields">
    <label
      >Defense bonus<input
        type="number"
        :aria-label="`Defense bonus for ${entry.name}`"
        :value="entry.shield.physicalBonus"
        @input="$emit('update', 'physicalBonus', numericValue($event))"
    /></label>
    <label
      >Magic Defense bonus<input
        type="number"
        :aria-label="`Magic Defense bonus for ${entry.name}`"
        :value="entry.shield.magicBonus"
        @input="$emit('update', 'magicBonus', numericValue($event))"
    /></label>
    <label
      >Initiative modifier<input
        type="number"
        :aria-label="`Initiative modifier for ${entry.name}`"
        :value="entry.shield.initiative"
        @input="$emit('update', 'initiative', numericValue($event))"
    /></label>
  </div>
</template>
<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-small);
  margin-top: var(--spacing-small);
}
.fields label {
  display: block;
  min-width: 0;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.fields select,
.fields input {
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
.wide {
  grid-column: 1 / -1;
}
</style>
