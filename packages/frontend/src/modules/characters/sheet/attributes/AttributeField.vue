<script setup lang="ts">
import InfoTooltip from "../../../../shared/design-system/InfoTooltip.vue";
import DieIcon from "../../../../shared/design-system/DieIcon.vue";
defineProps<{ label: string; help: string }>();
const value = defineModel<string>({ required: true });
const dice = ["6", "8", "10", "12"].map((size) => ({ label: `d${size}`, value: size }));
</script>

<template>
  <div class="die">
    <div class="stat-label">
      <span>{{ label }}</span
      ><InfoTooltip :label="`About ${label}`" :text="help" />
    </div>
    <div class="die-value">
      <DieIcon :sides="value" /><USelect
        v-model="value"
        :items="dice"
        value-key="value"
        :aria-label="label"
        :data-testid="`attribute-die-${label}`"
        variant="ghost"
        class="die-select"
      >
        <template #item-label="{ item }"
          ><span :data-testid="`attribute-die-option-${item.value}`">{{
            item.label
          }}</span></template
        >
      </USelect>
    </div>
  </div>
</template>

<style scoped>
.die {
  min-width: 0;
  display: grid;
  text-align: center;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  padding: var(--sheet-tight) var(--spacing-small);
}
.stat-label {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.25rem;
  color: var(--ui-text-muted);
  font-size: var(--sheet-label-size);
  font-weight: 700;
  letter-spacing: 0.05em;
}
.die-value {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}
.die-value :deep(.die-icon) {
  width: 1rem;
  height: 1rem;
}
.die-select {
  min-width: 0;
  font-weight: 700;
}
</style>
