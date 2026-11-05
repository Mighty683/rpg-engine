<script setup lang="ts">
import type { DefenseKind, NamedEntry } from "./mock-api";
const props = defineProps<{ entry: NamedEntry; entries: NamedEntry[] }>();
function setKind(event: Event) {
  const kind = (event.target as HTMLSelectElement).value as DefenseKind | "";
  props.entry.defenseKind = kind || undefined;
  props.entry.equipped = false;
  if (kind === "armor" && !props.entry.armor) props.entry.armor = { fixedDefense: null, physicalBonus: 0, magicBonus: 0, initiative: 0 };
  if (kind === "shield" && !props.entry.shield) props.entry.shield = { physicalBonus: 0, magicBonus: 0, initiative: 0 };
}
function setEquipped(event: Event) {
  const equipped = (event.target as HTMLInputElement).checked;
  if (equipped) {
    for (const item of props.entries) {
      if (item.id !== props.entry.id && item.itemType === "armor" && item.defenseKind === props.entry.defenseKind) item.equipped = false;
    }
  }
  props.entry.equipped = equipped;
}
function numericValue(event: Event): number {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  return Number.isFinite(value) ? value : 0;
}
</script>

<template>
  <div class="defense-settings">
    <label>Defense equipment<select :value="entry.defenseKind ?? ''" :aria-label="`Defense equipment type for ${entry.name}`" @change="setKind"><option value="">None</option><option value="armor">Armor</option><option value="shield">Shield</option></select></label>
    <template v-if="entry.defenseKind">
      <label class="equipped"><input type="checkbox" :checked="entry.equipped" :data-testid="`equip-${entry.id}`" :aria-label="`Equip ${entry.name}`" @change="setEquipped" /> Equipped</label>
      <p class="hint">Equipping another {{ entry.defenseKind }} replaces this one.</p>
    </template>
    <div v-if="entry.defenseKind === 'armor' && entry.armor" class="fields">
      <label class="wide">Physical Defense<select :value="entry.armor.fixedDefense === null ? 'dex' : 'fixed'" :data-testid="`defense-mode-${entry.id}`" :aria-label="`Defense calculation for ${entry.name}`" @change="entry.armor.fixedDefense = ($event.target as HTMLSelectElement).value === 'fixed' ? 0 : null"><option value="dex">DEX + bonus</option><option value="fixed">Fixed value</option></select></label>
      <label v-if="entry.armor.fixedDefense !== null">Fixed Defense<input type="number" :data-testid="`fixed-defense-${entry.id}`" :aria-label="`Fixed Defense for ${entry.name}`" :value="entry.armor.fixedDefense" @input="entry.armor.fixedDefense = numericValue($event)" /></label>
      <label v-else>DEX bonus<input type="number" :aria-label="`DEX bonus for ${entry.name}`" :value="entry.armor.physicalBonus" @input="entry.armor.physicalBonus = numericValue($event)" /></label>
      <label>Magic Defense bonus<input type="number" :aria-label="`Magic Defense bonus for ${entry.name}`" :value="entry.armor.magicBonus" @input="entry.armor.magicBonus = numericValue($event)" /></label>
      <label>Initiative modifier<input type="number" :aria-label="`Initiative modifier for ${entry.name}`" :value="entry.armor.initiative" @input="entry.armor.initiative = numericValue($event)" /></label>
    </div>
    <div v-if="entry.defenseKind === 'shield' && entry.shield" class="fields">
      <label>Defense bonus<input type="number" :aria-label="`Defense bonus for ${entry.name}`" :value="entry.shield.physicalBonus" @input="entry.shield.physicalBonus = numericValue($event)" /></label>
      <label>Magic Defense bonus<input type="number" :aria-label="`Magic Defense bonus for ${entry.name}`" :value="entry.shield.magicBonus" @input="entry.shield.magicBonus = numericValue($event)" /></label>
      <label>Initiative modifier<input type="number" :aria-label="`Initiative modifier for ${entry.name}`" :value="entry.shield.initiative" @input="entry.shield.initiative = numericValue($event)" /></label>
    </div>
  </div>
</template>

<style scoped>
.defense-settings { margin-top: var(--spacing-medium); border-top: 1px solid var(--ui-border); padding-top: var(--spacing-small); }
.defense-settings label { display: block; min-width: 0; font-size: 0.75rem; color: var(--ui-text-muted); }
.defense-settings select, .defense-settings input[type="number"] { display: block; width: 100%; min-width: 0; background: var(--ui-bg); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); color: var(--ui-text); padding: var(--spacing-small); font-size: 0.875rem; }
.defense-settings .equipped { display: flex; align-items: center; gap: var(--spacing-small); margin-top: var(--spacing-small); font-size: var(--text-body); color: var(--ui-text); }
.hint { font-size: 0.75rem; color: var(--ui-text-muted); }
.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-small); margin-top: var(--spacing-small); }
.wide { grid-column: 1 / -1; }
</style>
