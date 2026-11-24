<script setup lang="ts">
import LabeledInput from "../../../../shared/design-system/base/LabeledInput.vue";
defineProps<{ name: string }>();
const notes = defineModel<string>({ required: true });
</script>
<template>
  <LabeledInput
    label="Notes"
    hint="Optional"
    v-model="notes"
    :aria-label="`Notes for ${name}`"
    placeholder="Add notes"
  />
</template>
