<script setup lang="ts">
import type { Attribute } from "./types";
import DieIcon from "../../shared/design-system/domain/DieIcon.vue";

defineProps<{ attribute: Attribute; sides: number; characterName: string; canRoll: boolean }>();
defineEmits<{ roll: [] }>();
</script>

<template>
  <UTooltip
    :text="canRoll ? `Roll a ${attribute} check` : 'You cannot roll this character'"
    :content="{ side: 'top' }"
  >
    <button
      type="button"
      class="attribute-card"
      :data-testid="`roll-attribute-${attribute}`"
      :aria-label="`Roll ${attribute} check for ${characterName}`"
      :disabled="!canRoll"
      @click="$emit('roll')"
    >
      <span>{{ attribute }}</span
      ><DieIcon :sides="sides" /><strong>d{{ sides }}</strong>
    </button>
  </UTooltip>
</template>

<style scoped>
.attribute-card {
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: var(--dice-control-gap);
  padding: var(--dice-control-padding);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  font-size: var(--dice-label-size);
  cursor: pointer;
}
.attribute-card:hover:not(:disabled) {
  border-color: var(--ui-primary);
}
.attribute-card:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
.attribute-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
:deep(.die-icon) {
  width: 1.1rem;
  height: 1.1rem;
}
</style>
