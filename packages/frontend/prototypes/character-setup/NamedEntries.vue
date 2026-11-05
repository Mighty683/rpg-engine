<script setup lang="ts">
import { computed, ref } from "vue";
import DetailCard from "../design-system/DetailCard.vue";
import EquipmentIcon from "../design-system/EquipmentIcon.vue";
import WeaponIcon from "../design-system/WeaponIcon.vue";
import EquipmentDefenseFields from "./EquipmentDefenseFields.vue";
import type { NamedEntry } from "./mock-api";
const props = defineProps<{ entries: NamedEntry[]; kind: "item" | "skill" | "class"; price?: boolean; limit?: number; locked?: boolean }>();
const name = ref("");
const expanded = ref<string | null>(null);
const atLimit = computed(() => props.limit !== undefined && props.entries.length >= props.limit);
function add() {
  const value = name.value.trim();
  if (!value || atLimit.value) return;
  const entry = { id: crypto.randomUUID(), name: value, notes: "", price: null };
  props.entries.push(entry); name.value = ""; expanded.value = entry.id;
}
function setItemType(entry: NamedEntry, type: "other" | "weapon" | "armor") {
  entry.itemType = type;
  if (entry.itemType === "weapon" && !entry.weapon) entry.weapon = { attributes: ["", ""], accuracyBonus: null };
  if (entry.itemType === "armor" && entry.equipped) {
    for (const item of props.entries) {
      if (item.id !== entry.id && item.itemType === "armor" && item.defenseKind === entry.defenseKind) item.equipped = false;
    }
  }
}
function remove(id: string) { const index = props.entries.findIndex((entry) => entry.id === id); if (index !== -1) props.entries.splice(index, 1); if (expanded.value === id) expanded.value = null; }
</script>

<template>
  <ul class="entry-list" :class="{ 'entry-list-classes': kind === 'class' }">
    <li v-for="entry in entries" :key="entry.id">
      <DetailCard :title="entry.name" :remove-test-id="`remove-${entry.id}`" :locked="locked" :weapon="kind === 'item' && entry.itemType === 'weapon'" :equipped="kind === 'item' && entry.itemType === 'weapon' ? !!entry.weapon?.equipped : kind === 'item' && entry.itemType === 'armor' && entry.defenseKind ? !!entry.equipped : undefined" :notes="entry.notes" :price="price ? entry.price : null" :remove-label="`Remove ${kind} ${entry.name}`" :remove-below="kind === 'class'" :open="expanded === entry.id" @update:open="expanded = $event ? entry.id : null" @remove="remove(entry.id)">
        <template v-if="kind === 'item'" #title><label class="editor-name"><span class="sr-only">Item name</span><input v-model="entry.name" aria-label="Item name" /></label></template>
        <div class="entry-details" :class="{ 'entry-details-single': !price }"><label>Notes <span class="text-muted">(optional)</span><input v-model="entry.notes" :aria-label="`Notes for ${entry.name}`" placeholder="Add notes" /></label><label v-if="price">Price (ZNT)<input :value="entry.price" @input="entry.price = ($event.target as HTMLInputElement).value === '' ? null : ($event.target as HTMLInputElement).valueAsNumber" :aria-label="`Price for ${entry.name}`" type="number" min="0" placeholder="—" /></label></div>
        <div v-if="kind === 'item'" class="weapon-settings">
          <fieldset class="item-type"><legend>Item type</legend><div class="type-options"><label v-for="type in (['other', 'weapon', 'armor'] as const)" :key="type" class="type-option" :class="{ selected: (entry.itemType ?? 'other') === type }"><input type="radio" :name="`item-type-${entry.id}`" :value="type" :checked="(entry.itemType ?? 'other') === type" @change="setItemType(entry, type)" /><WeaponIcon v-if="type === 'weapon'" /><EquipmentIcon v-else :kind="type" /><span>{{ type }}</span></label></div></fieldset>
          <label v-if="entry.itemType === 'weapon' && entry.weapon" class="weapon-equipped"><input v-model="entry.weapon.equipped" type="checkbox" :data-testid="`equip-weapon-${entry.id}`" :aria-label="`Equip ${entry.name}`" /> Equipped</label>
          <div v-if="entry.itemType === 'weapon' && entry.weapon" class="weapon-fields">
            <label v-for="index in ([0, 1] as const)" :key="index">Attribute {{ index + 1 }}<select v-model="entry.weapon.attributes[index]" :aria-label="`Weapon attribute ${index + 1} for ${entry.name}`"><option value="">Select</option><option value="DEX">DEX</option><option value="INS">INS</option><option value="MIG">MIG</option><option value="WLP">WLP</option></select></label>
            <label>Accuracy bonus<input :value="entry.weapon.accuracyBonus" type="number" :aria-label="`Accuracy bonus for ${entry.name}`" placeholder="—" @input="entry.weapon.accuracyBonus = ($event.target as HTMLInputElement).value === '' ? null : ($event.target as HTMLInputElement).valueAsNumber" /></label>
          </div>
        </div>
        <EquipmentDefenseFields v-if="kind === 'item' && entry.itemType === 'armor'" :entry="entry" :entries="entries" />
      </DetailCard>
    </li>
  </ul>
  <p v-if="!entries.length && kind !== 'skill'" class="text-muted">No {{ kind === "class" ? "classes" : `${kind}s` }} yet.</p>
  <form v-if="!atLimit" class="entry-add" @submit.prevent="add"><label class="sr-only" :for="`${kind}-name`">{{ kind }} name</label><input :id="`${kind}-name`" v-model="name" :placeholder="`${kind === 'item' ? 'Item' : kind === 'class' ? 'Class' : 'Skill'} name`" /><UButton type="submit" size="sm" variant="outline">Add</UButton></form>
  <p v-else class="text-muted">Maximum {{ limit }} classes.</p>
</template>

<style scoped>
.entry-list { display: grid; gap: var(--spacing-small); }
.entry-list-classes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.entry-details { display: grid; grid-template-columns: minmax(0, 1fr) minmax(6rem, 0.4fr); gap: var(--spacing-small); align-items: end; padding-top: var(--spacing-small); }
.entry-details-single { grid-template-columns: 1fr; }
.entry-details label { min-width: 0; font-size: 0.75rem; color: var(--ui-text-muted); }
.editor-name { display: block; flex: 1; min-width: 0; margin-right: var(--spacing-large); }
.editor-name input, .entry-details input, .entry-add input, .weapon-fields input, .weapon-fields select, .item-type select { display: block; width: 100%; min-width: 0; background: var(--ui-bg); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); color: var(--ui-text); padding: var(--spacing-small); font-size: 0.875rem; }
.weapon-settings { margin-top: var(--spacing-medium); border-top: 1px solid var(--ui-border); padding-top: var(--spacing-small); }
.item-type { font-size: 0.75rem; color: var(--ui-text-muted); }
.type-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-small); margin-top: var(--sheet-tight, 0.25rem); }
.type-option { display: flex; align-items: center; justify-content: center; gap: 0.25rem; min-width: 0; padding: var(--spacing-small); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); color: var(--ui-text); cursor: pointer; text-transform: capitalize; }
.type-option.selected { border-color: var(--ui-primary); background: var(--ui-bg-muted); }
.type-option input { position: absolute; opacity: 0; }
.type-option:has(input:focus-visible) { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.weapon-equipped { display: flex; align-items: center; gap: var(--spacing-small); margin-top: var(--spacing-small); }
.weapon-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-small); margin-top: var(--spacing-small); }
.weapon-fields label { min-width: 0; font-size: 0.75rem; color: var(--ui-text-muted); }
.entry-add { display: flex; gap: var(--spacing-small); margin-top: var(--spacing-small); }
.entry-add input { flex: 1; }
@media (max-width: 640px) { .entry-details { grid-template-columns: 1fr; } }
</style>
