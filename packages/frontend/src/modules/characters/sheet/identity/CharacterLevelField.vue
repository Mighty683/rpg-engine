<script setup lang="ts">
withDefaults(defineProps<{ level: number; max?: number; label?: string; testId?: string }>(), {
  max: 50,
  label: "Character level",
});
defineEmits<{ change: [event: Event] }>();
</script>

<template>
  <label class="level-mark"
    ><span>LEVEL</span
    ><input
      type="number"
      min="5"
      :max="max"
      :value="level"
      :aria-label="label"
      :data-testid="testId"
      @change="$emit('change', $event)"
  /></label>
</template>

<style scoped>
.level-mark {
  display: grid;
  text-align: center;
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  padding: var(--spacing-small) var(--spacing-medium);
  line-height: 1;
  color: var(--ui-text-muted);
  font-size: var(--sheet-label-size);
  font-weight: 700;
  letter-spacing: 0.05em;
}
input {
  width: 3.5rem;
  justify-self: center;
  appearance: textfield;
  text-align: center;
  color: var(--ui-text-highlighted);
  font-size: var(--text-body);
  line-height: normal;
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  background: var(--ui-bg);
}
input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
</style>
