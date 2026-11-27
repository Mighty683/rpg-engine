<script setup lang="ts">
import { tr } from "../../i18n";
import { computed } from "vue";
import ProgressActionButton from "./ProgressActionButton.vue";
/** Discrete progress with optional endpoint controls; segment count excludes the controls. */
const props = defineProps<{
  value: number;
  maximum: number;
  label: string;
  valueText?: string;
  editable?: boolean;
  disabled?: boolean;
  increaseBlockedReason?: string;
  decreaseBlockedReason?: string;
}>();
defineEmits<{ increase: []; decrease: [] }>();
const maximum = computed(() =>
  Number.isFinite(props.maximum) ? Math.max(1, Math.floor(props.maximum)) : 1,
);
const value = computed(() =>
  Number.isFinite(props.value) ? Math.min(maximum.value, Math.max(0, Math.floor(props.value))) : 0,
);
const decreaseReason = computed(() => {
  if (props.disabled) return tr("ui.waitForTheCurrentChangeToSave");
  if (value.value <= 0) return tr("ui.alreadyAtTheMinimum");
  return props.decreaseBlockedReason;
});
const increaseReason = computed(() => {
  if (props.disabled) return tr("ui.waitForTheCurrentChangeToSave");
  if (value.value >= maximum.value)
    return props.increaseBlockedReason ?? tr("ui.alreadyAtTheMaximum");
  return props.increaseBlockedReason;
});
</script>
<template>
  <div class="flex min-w-0 items-center gap-tight" @click.stop>
    <ProgressActionButton
      v-if="editable"
      class="h-6 w-6 justify-center p-0"
      :aria-label="tr('ui.decreaseValue1', { value1: label })"
      :blocked-reason="decreaseReason"
      data-testid="decrease-progress"
      @click="$emit('decrease')"
      >−</ProgressActionButton
    >
    <div
      role="progressbar"
      :aria-label="label"
      :aria-valuemin="0"
      :aria-valuemax="maximum"
      :aria-valuenow="value"
      :aria-valuetext="valueText ?? tr('ui.value1OfValue2', { value1: value, value2: maximum })"
      class="flex min-w-0 flex-1 gap-tight"
      data-testid="progress-meter"
    >
      <span
        v-for="segment in maximum"
        :key="segment"
        aria-hidden="true"
        class="min-w-0 flex-1 rounded-control"
        :class="[editable ? 'h-6' : 'h-1.5', segment <= value ? 'bg-primary' : 'bg-accented']"
        :data-filled="segment <= value"
      />
    </div>
    <ProgressActionButton
      v-if="editable"
      class="h-6 w-6 justify-center p-0"
      :aria-label="tr('ui.increaseValue1', { value1: label })"
      :blocked-reason="increaseReason"
      data-testid="increase-progress"
      @click="$emit('increase')"
      >+</ProgressActionButton
    >
  </div>
</template>
