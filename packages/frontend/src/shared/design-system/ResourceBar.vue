<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ label: string; value: number; maximum: number; color: "hp" | "mp" }>();
const percentage = computed(() =>
  props.maximum > 0 ? Math.min(100, Math.max(0, (props.value / props.maximum) * 100)) : 0,
);
</script>

<template>
  <div
    class="resource-bar"
    :class="[color, { 'has-content': $slots.default }]"
    role="progressbar"
    :aria-label="`${label} remaining`"
    :aria-valuenow="Math.min(Math.max(0, value), Math.max(0, maximum))"
    aria-valuemin="0"
    :aria-valuemax="Math.max(0, maximum)"
    :aria-valuetext="`${value} of ${maximum}`"
  >
    <div class="fill" :style="{ width: `${percentage}%` }" />
    <span v-if="$slots.default" class="bar-content"><slot /></span>
  </div>
</template>

<style scoped>
.resource-bar {
  position: relative;
  height: var(--spacing-medium);
  min-width: 0;
  overflow: hidden;
  border-radius: var(--radius-panel);
  background: var(--ui-bg-accented);
}
.bar-content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-text-highlighted);
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 1px 2px var(--ui-bg);
}
.fill {
  height: 100%;
  border-radius: inherit;
}
.resource-bar.has-content {
  height: var(--spacing-field);
}
.hp .fill {
  background: var(--ui-error);
}
.mp .fill {
  background: var(--ui-info);
}
</style>
