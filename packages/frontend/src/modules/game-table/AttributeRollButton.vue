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
  gap: 0.125rem;
  padding: 0.25rem 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  font-size: 0.65rem;
  cursor: pointer;
}
.attribute-card:hover:not(:disabled) {
  border-color: var(--ui-primary);
}
.attribute-card:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
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
