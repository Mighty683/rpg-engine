<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
import LabeledInput from "../../../../shared/design-system/base/LabeledInput.vue";
defineProps<{ name: string }>();
const notes = defineModel<string>({ required: true });
</script>
<template>
  <LabeledInput
    :label="tr('ui.notes')"
    :hint="tr('ui.optional')"
    v-model="notes"
    :aria-label="tr('ui.notesForValue1', { value1: name })"
    :placeholder="tr('ui.addNotes')"
  />
</template>
