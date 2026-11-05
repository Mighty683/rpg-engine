<script setup lang="ts">
import EquipmentTypeField from "./EquipmentTypeField.vue";
import WeaponFields from "./WeaponFields.vue";
import EquipmentDefenseFields from "./EquipmentDefenseFields.vue";
import type { Attribute, NamedEntry } from "./types";
const props = defineProps<{ entry: NamedEntry }>();
function setWeaponEquipped(value: boolean) { if (props.entry.weapon) props.entry.weapon.equipped = value; }
function setWeaponAttribute(index: 0 | 1, value: Attribute | "") { if (props.entry.weapon) props.entry.weapon.attributes[index] = value; }
function setWeaponAccuracy(value: number | null) { if (props.entry.weapon) props.entry.weapon.accuracyBonus = value; }
function setItemType(type: "other" | "weapon" | "armor") {
  props.entry.itemType = type;
  if (type === "weapon" && !props.entry.weapon) props.entry.weapon = { attributes: ["", ""], accuracyBonus: null };
}
</script>
<template>
  <div class="weapon-settings"><EquipmentTypeField :entry="entry" @select="setItemType" /><WeaponFields :entry="entry" @equipped="setWeaponEquipped" @attribute="setWeaponAttribute" @accuracy="setWeaponAccuracy" /></div>
  <EquipmentDefenseFields v-if="entry.itemType === 'armor'" :entry="entry" />
</template>
<style scoped>
.weapon-settings { margin-top: var(--spacing-medium); border-top: 1px solid var(--ui-border); padding-top: var(--spacing-small); }
</style>
