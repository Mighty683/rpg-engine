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
  gap: 0.125rem;
  padding: 0.25rem 0.375rem;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  font-size: 0.65rem;
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
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.die-button.opposing:focus-visible {
  outline-color: var(--ui-error);
}
.die-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
