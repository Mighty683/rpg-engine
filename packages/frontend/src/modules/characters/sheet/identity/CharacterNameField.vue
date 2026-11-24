<script setup lang="ts">
import LabeledInput from "../../../../shared/design-system/base/LabeledInput.vue";
import { ref } from "vue";
defineProps<{ showReadOnlyBadge?: boolean; controller?: string }>();
const value = defineModel<string>({ required: true });
const heading = ref<HTMLElement>();
defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>
  <div class="name-field min-w-0">
    <div class="flex flex-wrap items-baseline justify-between gap-x-small">
      <p class="sheet-kicker">FABULA ULTIMA <span> / CHARACTER SHEET</span></p>
      <p v-if="controller" class="text-label text-muted">Controlled by {{ controller }}.</p>
    </div>
    <h1 ref="heading" tabindex="-1" class="sr-only">Character sheet</h1>
    <div class="flex min-w-0 items-center gap-small">
      <LabeledInput
        class="min-w-0 flex-1"
        label="Character name"
        hide-label
        data-testid="character-name"
        v-model="value"
        placeholder="Character name"
      />
      <UBadge
        v-if="showReadOnlyBadge"
        color="neutral"
        variant="subtle"
        class="whitespace-normal"
        data-testid="sheet-editability"
        >Read-only</UBadge
      >
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
  letter-spacing: var(--sheet-label-tracking);
}
@media (max-width: 640px) {
  .name-field {
    grid-column: 1 / -1;
  }
}
</style>
