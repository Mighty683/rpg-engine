<script setup lang="ts">
import type { ProgressionExperience } from "./types";

const props = defineProps<{
  experience: ProgressionExperience;
  readOnly?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ change: [field: keyof ProgressionExperience, value: number] }>();
function change(field: keyof ProgressionExperience, event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.valueAsNumber;
  input.value = String(props.experience[field]);
  emit("change", field, value);
}
</script>

<template>
  <div class="sheet-stat" role="group" aria-label="Experience">
    <span>EXP</span>
    <p v-if="readOnly">{{ experience.current }} / {{ experience.total }}</p>
    <div v-else class="flex min-w-0 items-center justify-center gap-tight">
      <input
        :value="experience.current"
        type="number"
        min="0"
        :disabled="disabled"
        aria-label="Current EXP"
        data-testid="current-exp"
        @change="change('current', $event)"
      />
      <span aria-hidden="true">/</span>
      <input
        :value="experience.total"
        type="number"
        min="0"
        :disabled="disabled"
        aria-label="Total EXP"
        data-testid="total-exp"
        @change="change('total', $event)"
      />
    </div>
  </div>
</template>

<style scoped src="../characters/sheet/identity/sheet-stat.css"></style>
