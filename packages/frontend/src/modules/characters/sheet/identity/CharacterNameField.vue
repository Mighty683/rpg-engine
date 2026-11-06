<script setup lang="ts">
import { ref } from "vue";
defineProps<{ readOnly?: boolean }>();
const value = defineModel<string>({ required: true });
const heading = ref<HTMLElement>();
defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>
  <div class="name-field min-w-0">
    <p class="sheet-kicker">FABULA ULTIMA <span> / CHARACTER SHEET</span></p>
    <h1 ref="heading" tabindex="-1" class="sr-only">Character sheet</h1>
    <div class="flex min-w-0 items-center gap-small">
      <label class="sheet-name min-w-0 flex-1"
        ><span class="sr-only">Character name</span
        ><input data-testid="character-name" v-model="value" placeholder="Character name"
      /></label>
      <UBadge v-if="readOnly" color="neutral" variant="subtle">Read-only</UBadge>
    </div>
  </div>
</template>

<style scoped>
.name-field {
  display: flex;
  flex-direction: column;
  justify-content: end;
}
.sheet-kicker {
  color: var(--ui-primary);
  font-size: var(--sheet-label-size);
  font-weight: 700;
  letter-spacing: 0.05em;
}
input {
  display: block;
  width: 100%;
  min-width: 0;
  color: var(--ui-text-highlighted);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  padding: var(--sheet-tight) var(--spacing-small);
  font-size: var(--text-body);
  line-height: 1.5rem;
  font-weight: 400;
  letter-spacing: normal;
}
input::placeholder {
  color: var(--ui-text-muted);
}
@media (max-width: 640px) {
  .name-field {
    grid-column: 1 / -1;
  }
}
</style>
