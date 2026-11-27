<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
withDefaults(
  defineProps<{
    level: number;
    max?: number;
    label?: string;
    testId?: string;
    disabled?: boolean;
  }>(),
  {
    max: 50,
    label: tr("ui.characterLevel"),
  },
);
defineEmits<{ change: [event: Event] }>();
</script>

<template>
  <label class="sheet-stat"
    ><span>{{ tr("ui.level") }}</span
    ><input
      type="number"
      min="5"
      :max="max"
      :value="level"
      :disabled="disabled"
      :aria-label="label"
      :data-testid="testId"
      @change="$emit('change', $event)"
  /></label>
</template>

<style scoped src="./sheet-stat.css"></style>
