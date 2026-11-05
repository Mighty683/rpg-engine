<script setup lang="ts">
import { computed, ref } from "vue";
import ClassCard from "./ClassCard.vue";
import SkillCard from "./SkillCard.vue";
import EquipmentCard from "./EquipmentCard.vue";
import type { NamedEntry } from "./types";
const props = defineProps<{ entries: NamedEntry[]; kind: "item" | "skill" | "class"; limit?: number; locked?: boolean }>();
const name = ref("");
const expanded = ref<string | null>(null);
const atLimit = computed(() => props.limit !== undefined && props.entries.length >= props.limit);
function add() {
  const value = name.value.trim();
  if (!value || atLimit.value) return;
  const entry = { id: crypto.randomUUID(), name: value, notes: "", price: null };
  props.entries.push(entry); name.value = ""; expanded.value = entry.id;
}
function updateEntry(updated: NamedEntry) {
  const index = props.entries.findIndex((entry) => entry.id === updated.id);
  if (index === -1) return;
  if (kindIsEquippedArmor(updated)) {
    for (const entry of props.entries) {
      if (entry.id !== updated.id && entry.itemType === "armor" && entry.defenseKind === updated.defenseKind && entry.equipped) entry.equipped = false;
    }
  }
  props.entries[index] = updated;
}
function kindIsEquippedArmor(entry: NamedEntry) {
  return entry.itemType === "armor" && !!entry.defenseKind && !!entry.equipped;
}
function remove(id: string) { const index = props.entries.findIndex((entry) => entry.id === id); if (index !== -1) props.entries.splice(index, 1); if (expanded.value === id) expanded.value = null; }
</script>

<template>
  <ul class="entry-list" :class="{ 'entry-list-classes': kind === 'class' }">
    <li v-for="entry in entries" :key="entry.id">
      <component :is="kind === 'class' ? ClassCard : kind === 'skill' ? SkillCard : EquipmentCard" :entry="entry" :locked="locked" :open="expanded === entry.id" @update:open="expanded = $event ? entry.id : null" @update:entry="updateEntry" @remove="remove(entry.id)" />
    </li>
  </ul>
  <p v-if="!entries.length && kind !== 'skill'" class="text-muted">No {{ kind === "class" ? "classes" : `${kind}s` }} yet.</p>
  <form v-if="!atLimit" class="entry-add" @submit.prevent="add"><label class="sr-only" :for="`${kind}-name`">{{ kind }} name</label><input :id="`${kind}-name`" v-model="name" :placeholder="`${kind === 'item' ? 'Item' : kind === 'class' ? 'Class' : 'Skill'} name`" /><UButton type="submit" size="sm" variant="outline">Add</UButton></form>
  <p v-else class="text-muted">Maximum {{ limit }} classes.</p>
</template>

<style scoped>
.entry-list { display: grid; gap: var(--spacing-small); }
.entry-list-classes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.entry-add { display: flex; gap: var(--spacing-small); margin-top: var(--spacing-small); }
.entry-add input { display: block; width: 100%; min-width: 0; flex: 1; background: var(--ui-bg); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); color: var(--ui-text); padding: var(--spacing-small); font-size: 0.875rem; }

</style>
