<script setup lang="ts">
import EquipmentIcon from "../design-system/EquipmentIcon.vue";
import WeaponIcon from "../design-system/WeaponIcon.vue";
import type { NamedEntry } from "./types";
defineProps<{ entry: NamedEntry }>();
defineEmits<{ select: [type: "other" | "weapon" | "armor"] }>();
</script>
<template>
          <fieldset class="item-type"><legend>Item type</legend><div class="type-options"><label v-for="type in (['other', 'weapon', 'armor'] as const)" :key="type" class="type-option" :class="{ selected: (entry.itemType ?? 'other') === type }"><input type="radio" :name="`item-type-${entry.id}`" :value="type" :checked="(entry.itemType ?? 'other') === type" @change="$emit('select', type)" /><WeaponIcon v-if="type === 'weapon'" /><EquipmentIcon v-else :kind="type" /><span>{{ type }}</span></label></div></fieldset>
</template>
<style scoped>
.item-type { font-size: 0.75rem; color: var(--ui-text-muted); }
.type-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-small); margin-top: var(--sheet-tight, 0.25rem); }
.type-option { display: flex; align-items: center; justify-content: center; gap: 0.25rem; min-width: 0; padding: var(--spacing-small); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); color: var(--ui-text); cursor: pointer; text-transform: capitalize; }
.type-option.selected { border-color: var(--ui-primary); background: var(--ui-bg-muted); }
.type-option input { position: absolute; opacity: 0; }
.type-option:has(input:focus-visible) { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
</style>
