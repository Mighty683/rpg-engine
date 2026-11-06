<script setup lang="ts">
import ArmorFields from "./ArmorFields.vue";
import ShieldFields from "./ShieldFields.vue";
import type { DefenseKind, NamedEntry } from "../types";
const props = defineProps<{ entry: NamedEntry }>();
function setKind(event: Event) {
  const kind = (event.target as HTMLSelectElement).value as DefenseKind | "";
  props.entry.defenseKind = kind || undefined;
  props.entry.equipped = false;
  if (kind === "armor" && !props.entry.armor)
    props.entry.armor = { fixedDefense: null, physicalBonus: 0, magicBonus: 0, initiative: 0 };
  if (kind === "shield" && !props.entry.shield)
    props.entry.shield = { physicalBonus: 0, magicBonus: 0, initiative: 0 };
}
function updateArmor(field: string, value: number | null) {
  if (props.entry.armor) Object.assign(props.entry.armor, { [field]: value });
}
function updateShield(field: string, value: number | null) {
  if (props.entry.shield) Object.assign(props.entry.shield, { [field]: value });
}
function setEquipped(event: Event) {
  const equipped = (event.target as HTMLInputElement).checked;
  props.entry.equipped = equipped;
}
</script>

<template>
  <div class="defense-settings">
    <label
      >Defense equipment<select
        :value="entry.defenseKind ?? ''"
        :aria-label="`Defense equipment type for ${entry.name}`"
        @change="setKind"
      >
        <option value="">None</option>
        <option value="armor">Armor</option>
        <option value="shield">Shield</option>
      </select></label
    >
    <template v-if="entry.defenseKind">
      <label class="equipped"
        ><input
          type="checkbox"
          :checked="entry.equipped"
          :data-testid="`equip-${entry.id}`"
          :aria-label="`Equip ${entry.name}`"
          @change="setEquipped"
        />
        Equipped</label
      >
      <p class="hint">Equipping another {{ entry.defenseKind }} replaces this one.</p>
    </template>
    <ArmorFields :entry="entry" @update="updateArmor" />
    <ShieldFields :entry="entry" @update="updateShield" />
  </div>
</template>

<style scoped>
.defense-settings {
  margin-top: var(--spacing-medium);
  border-top: 1px solid var(--ui-border);
  padding-top: var(--spacing-small);
}
.defense-settings label {
  display: block;
  min-width: 0;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
.defense-settings select,
.defense-settings input[type="number"] {
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
.defense-settings .equipped {
  display: flex;
  align-items: center;
  gap: var(--spacing-small);
  margin-top: var(--spacing-small);
  font-size: var(--text-body);
  color: var(--ui-text);
}
.hint {
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
</style>
