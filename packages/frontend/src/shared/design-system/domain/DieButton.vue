<script setup lang="ts">
import DieIcon from "./DieIcon.vue";
withDefaults(defineProps<{ sides: number; opposing?: boolean }>(), { opposing: false });
</script>

<template>
  <button type="button" class="die-button" :class="{ opposing }">
    <DieIcon :sides="sides" /><span>d{{ sides }}</span>
  </button>
</template>

<style scoped>
.die-button {
  min-width: 2.75rem;
  display: grid;
  justify-items: center;
  gap: var(--dice-control-gap);
  padding: var(--dice-control-padding);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  font-size: var(--dice-label-size);
  font-weight: 700;
  cursor: pointer;
}
.die-button :deep(.die-icon) {
  width: 1.25rem;
  height: 1.25rem;
}
.die-button.opposing :deep(.die-icon) {
  color: var(--ui-error);
}
.die-button:hover:not(:disabled) {
  border-color: var(--ui-primary);
}
.die-button.opposing:hover:not(:disabled) {
  border-color: var(--ui-error);
}
.die-button:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
.die-button.opposing:focus-visible {
  outline-color: var(--ui-error);
}
.die-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
