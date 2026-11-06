<script setup lang="ts">
import DetailCard from "../../../../shared/design-system/DetailCard.vue";
import EntryNotesField from "../entries/EntryNotesField.vue";
import EquipmentEditor from "./EquipmentEditor.vue";
import { useEditableEntry } from "../entries/useEditableEntry";
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
    :remove-label="`Remove item ${draft.name}`"
    :locked="locked"
    :open="open"
    :weapon="draft.itemType === 'weapon'"
    :equipped="
      draft.itemType === 'weapon'
        ? !!draft.weapon?.equipped
        : draft.itemType === 'armor' && draft.defenseKind
          ? !!draft.equipped
          : undefined
    "
    :price="draft.price"
    @update:open="emit('update:open', $event)"
    @remove="emit('remove')"
    ><template #title
      ><label class="editor-name"
        ><span class="sr-only">Item name</span
        ><input v-model="draft.name" aria-label="Item name" /></label
    ></template>
    <div class="entry-details">
      <EntryNotesField v-model="draft.notes" :name="draft.name" /><label
        >Price (ZNT)<input
          :value="draft.price"
          @input="
            draft.price =
              ($event.target as HTMLInputElement).value === ''
                ? null
                : ($event.target as HTMLInputElement).valueAsNumber
          "
          :aria-label="`Price for ${draft.name}`"
          type="number"
          min="0"
          placeholder="—"
      /></label>
    </div>
    <EquipmentEditor :entry="draft"
  /></DetailCard>
</template>
<style scoped>
.entry-details {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(6rem, 0.4fr);
  gap: var(--spacing-small);
  align-items: end;
  padding-top: var(--spacing-small);
}
.entry-details label {
  min-width: 0;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.editor-name {
  display: block;
  flex: 1;
  min-width: 0;
  margin-right: var(--spacing-large);
}
.editor-name input,
.entry-details input {
  display: block;
  width: 100%;
  min-width: 0;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  color: var(--ui-text);
  padding: var(--spacing-small);
  font-size: 0.875rem;
}
@media (max-width: 640px) {
  .entry-details {
    grid-template-columns: 1fr;
  }
}
</style>
