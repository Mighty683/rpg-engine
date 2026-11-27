<script setup lang="ts">
import { tr } from "../../i18n";
import DieIcon from "./DieIcon.vue";
withDefaults(defineProps<{ sides: number; opposing?: boolean }>(), { opposing: false });
</script>

<template>
  <button type="button" class="die-button die-tile" :class="{ opposing }">
    <DieIcon :sides="sides" /><span>{{ tr("ui.dValue1", { value1: sides }) }}</span>
  </button>
</template>

<style scoped>
.die-button {
  cursor: pointer;
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
