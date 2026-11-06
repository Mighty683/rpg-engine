<script setup lang="ts">
defineProps<{ label: string; maximum?: number; maximumOverride?: number | null }>();
const emit = defineEmits<{ override: [value: number | null] }>();
const value = defineModel<number | null>({ required: true });
function update(event: Event) {
  const number = (event.target as HTMLInputElement).valueAsNumber;
  if (Number.isFinite(number) && number >= 0) value.value = number;
}
function updateMaximum(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.value === "") emit("override", null);
  else if (Number.isInteger(input.valueAsNumber) && input.valueAsNumber >= 0)
    emit("override", input.valueAsNumber);
}
</script>

<template>
  <div class="resource">
    <strong>{{ label }}</strong
    ><span v-if="maximum !== undefined" class="resource-values"
      ><input
        type="number"
        min="0"
        :data-testid="`character-${label.toLowerCase()}`"
        :aria-label="`Current ${label}`"
        :value="value ?? maximum"
        @input="update"
      /><span aria-hidden="true">/</span
      ><UPopover>
        <button
          type="button"
          class="maximum"
          :data-testid="`maximum-button-${label}`"
          :aria-label="`Edit maximum ${label}, currently ${maximum}`"
        >
          {{ maximum }}
        </button>
        <template #content>
          <div class="maximum-editor">
            <label :for="`maximum-${label}`">Maximum {{ label }} override</label>
            <input
              :id="`maximum-${label}`"
              :data-testid="`maximum-input-${label}`"
              type="number"
              min="0"
              :value="maximumOverride"
              placeholder="Calculated"
              @change="updateMaximum"
            />
            <UButton size="sm" color="neutral" variant="outline" @click="emit('override', null)"
              >Use calculated</UButton
            >
          </div>
        </template>
      </UPopover></span
    ><input
      v-else
      type="number"
      min="0"
      aria-label="Fabula points"
      :value="value"
      @input="update"
    />
  </div>
</template>

<style scoped>
.resource {
  min-width: 0;
  display: grid;
  text-align: center;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  padding: var(--sheet-tight) var(--spacing-small);
}
strong {
  color: var(--ui-text-muted);
  font-size: var(--sheet-label-size);
  font-weight: 700;
  letter-spacing: 0.05em;
}
.resource input {
  width: 4ch;
  min-width: 0;
  justify-self: center;
  appearance: textfield;
  text-align: center;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  color: var(--ui-text-highlighted);
  font-weight: 700;
}
.resource input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
.resource-values {
  width: 100%;
  display: grid;
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  background: var(--ui-bg);
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--sheet-tight);
  white-space: nowrap;
}
.resource-values input {
  width: 100%;
  text-align: right;
  border: 0;
  background: transparent;
  outline: none;
}
.resource-values span {
  font-weight: 700;
  color: var(--ui-text-muted);
}
.maximum {
  text-align: left;
  color: var(--ui-text-muted);
  font-weight: 700;
}
.maximum-editor {
  display: grid;
  gap: var(--spacing-small);
  padding: var(--spacing-small);
}
.maximum-editor input {
  width: 100%;
  text-align: left;
}
.resource-values:focus-within {
  outline: 2px solid var(--ui-primary);
  outline-offset: 1px;
}
</style>
