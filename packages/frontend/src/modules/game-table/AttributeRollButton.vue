<script setup lang="ts">
import { tr } from "../../shared/i18n";
import type { Attribute } from "./types";
import DieIcon from "../../shared/design-system/domain/DieIcon.vue";

defineProps<{ attribute: Attribute; sides: number; characterName: string; canRoll: boolean }>();
defineEmits<{ roll: [] }>();
</script>

<template>
  <UTooltip
    :text="
      canRoll
        ? tr('ui.rollAValue1Check', { value1: attribute })
        : tr('ui.youCannotRollThisCharacter')
    "
    :content="{ side: 'top' }"
  >
    <button
      type="button"
      class="attribute-card"
      :data-testid="`roll-attribute-${attribute}`"
      :aria-label="tr('ui.rollValue1CheckForValue2', { value1: attribute, value2: characterName })"
      :disabled="!canRoll"
      @click="$emit('roll')"
    >
      <span>{{ attribute }}</span>
      <strong class="die-value"
        ><DieIcon :sides="sides" />{{ tr("ui.dValue1", { value1: sides }) }}</strong
      >
    </button>
  </UTooltip>
</template>

<style scoped>
.attribute-card {
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: var(--table-card-detail-gap);
  padding: var(--table-card-die-padding);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  font-size: var(--table-card-label-size);
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
.die-value {
  display: inline-flex;
  align-items: center;
  gap: var(--table-card-detail-gap);
  white-space: nowrap;
}
:deep(.die-icon) {
  width: var(--table-card-die-size);
  height: var(--table-card-die-size);
}
</style>
