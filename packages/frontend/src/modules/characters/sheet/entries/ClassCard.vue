<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
import DetailCard from "../../../../shared/design-system/base/DetailCard.vue";
import EntryNotesField from "./EntryNotesField.vue";
import { useEditableEntry } from "./useEditableEntry";
import type { NamedEntry } from "../types";
const props = defineProps<{ entry: NamedEntry; locked?: boolean; open: boolean }>();
const emit = defineEmits<{
  "update:open": [open: boolean];
  "update:entry": [entry: NamedEntry];
  remove: [];
}>();
const draft = useEditableEntry(
  () => props.entry,
  (entry) => emit("update:entry", entry),
);
</script>
<template>
  <DetailCard
    :title="draft.name"
    :notes="draft.notes"
    :remove-test-id="`remove-${draft.id}`"
    :remove-label="tr('ui.removeClassValue1', { value1: draft.name })"
    :remove-description="tr('ui.removeValue1FromThisCharacter', { value1: draft.name })"
    :locked="locked"
    :open="open"
    @update:open="emit('update:open', $event)"
    @remove="emit('remove')"
    ><div class="entry-details"><EntryNotesField v-model="draft.notes" :name="draft.name" /></div
  ></DetailCard>
</template>
<style scoped>
.entry-details {
  padding-top: var(--spacing-small);
}
:deep(.card-row > button) {
  align-self: flex-start;
}
</style>
