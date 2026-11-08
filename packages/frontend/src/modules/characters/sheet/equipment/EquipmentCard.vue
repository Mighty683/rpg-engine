<script setup lang="ts">
import { computed } from "vue";
import EquipmentIcon from "../../../../shared/design-system/EquipmentIcon.vue";
import WeaponIcon from "../../../../shared/design-system/WeaponIcon.vue";
import ZenitIcon from "../../../../shared/design-system/ZenitIcon.vue";
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
const equipped = computed(() => {
  if (draft.value.itemType === "weapon") return Boolean(draft.value.weapon?.equipped);
  if (draft.value.itemType === "armor" && draft.value.defenseKind) return Boolean(draft.value.equipped);
  return undefined;
});
</script>
<template>
  <DetailCard
    :title="draft.name"
    :notes="draft.notes"
    :remove-test-id="`remove-${draft.id}`"
    :remove-label="`Remove item ${draft.name}`"
    :locked="locked"
    :open="open"
    :edit-label="draft.itemType === 'weapon' ? `Edit ${draft.name}, weapon` : undefined"
    :remove-description="`Remove ${draft.name} from this character?`"
    @update:open="emit('update:open', $event)"
    @remove="emit('remove')"
  >
    <template #icon>
      <WeaponIcon v-if="draft.itemType === 'weapon'" />
      <EquipmentIcon v-else-if="draft.itemType === 'armor'" kind="armor" class="text-primary" />
    </template>
    <template #status>
      <span v-if="equipped !== undefined" class="equipment-status" :class="equipped ? 'text-primary' : 'text-muted'">
        <EquipmentIcon kind="equipped" />{{ equipped ? "Equipped" : "Not equipped" }}
      </span>
    </template>
    <template v-if="draft.price !== null" #trailing>
      <ZenitIcon /> {{ draft.price }} <span class="sr-only">zenits</span>
    </template>
    <template #title
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
.equipment-status {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-tight);
  font-size: var(--text-label);
}

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
