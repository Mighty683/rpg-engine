<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
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
      <p class="sheet-kicker">
        {{ tr("ui.fabulaUltima") }} <span> {{ tr("ui.characterSheet2") }}</span>
      </p>
      <p v-if="controller" class="text-label text-muted">
        {{ tr("ui.controlledByValue12", { value1: controller }) }}
      </p>
    </div>
    <h1 ref="heading" tabindex="-1" class="sr-only">{{ tr("ui.characterSheet") }}</h1>
    <div class="flex min-w-0 items-center gap-small">
      <LabeledInput
        class="min-w-0 flex-1"
        :label="tr('ui.characterName')"
        hide-label
        data-testid="character-name"
        v-model="value"
        :placeholder="tr('ui.characterName')"
      />
      <UBadge
        v-if="showReadOnlyBadge"
        color="neutral"
        variant="subtle"
        class="whitespace-normal"
        data-testid="sheet-editability"
        >{{ tr("ui.readOnly") }}</UBadge
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
