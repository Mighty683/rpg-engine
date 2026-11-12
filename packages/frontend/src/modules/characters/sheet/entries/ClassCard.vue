<script setup lang="ts">
import DetailCard from "../../../../shared/design-system/DetailCard.vue";
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
    :remove-label="`Remove class ${draft.name}`"
    :remove-description="`Remove ${draft.name} from this character?`"
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
