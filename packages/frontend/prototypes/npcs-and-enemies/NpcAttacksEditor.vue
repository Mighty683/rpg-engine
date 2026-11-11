<script setup lang="ts">
import SheetSection from "../../src/shared/design-system/SheetSection.vue";
import type { NpcAttack } from "./types";

const props = defineProps<{ attacks: NpcAttack[] }>();
const attributes = ["DEX", "INS", "MIG", "WLP"];

function addAttack() {
  props.attacks.push({
    id: crypto.randomUUID(),
    name: "New attack",
    range: "melee",
    attributes: ["DEX", "MIG"],
    damageBonus: 5,
    damageType: "physical",
  });
}
</script>

<template>
  <SheetSection>
    <template #heading>⚔ ATTACKS</template>
    <p v-if="!attacks.length" class="text-label text-muted">No attacks yet.</p>
    <div
      v-for="(attack, index) in attacks"
      :key="attack.id"
      class="attack"
      :data-testid="`attack-editor-${index}`"
    >
      <div class="attack-header">
        <label>Name<input v-model="attack.name" :data-testid="`attack-name-${index}`" /></label>
        <UButton
          color="error"
          variant="outline"
          type="button"
          :data-testid="`remove-attack-${index}`"
          :aria-label="`Remove ${attack.name}`"
          @click="attacks.splice(index, 1)"
          >Remove</UButton
        >
      </div>
      <div class="attack-fields">
        <label
          >Reach<select v-model="attack.range" :data-testid="`attack-range-${index}`">
            <option value="melee">Melee</option>
            <option value="ranged">Ranged</option>
          </select></label
        >
        <label v-for="attributeIndex in [0, 1] as const" :key="attributeIndex"
          >Attribute {{ attributeIndex + 1
          }}<select
            v-model="attack.attributes[attributeIndex]"
            :data-testid="`attack-attribute-${index}-${attributeIndex}`"
          >
            <option v-for="attribute in attributes" :key="attribute" :value="attribute">
              {{ attribute }}
            </option>
          </select></label
        >
        <label
          >Damage bonus<input
            v-model.number="attack.damageBonus"
            type="number"
            :data-testid="`attack-damage-${index}`"
        /></label>
        <label
          >Damage type<input
            v-model="attack.damageType"
            :data-testid="`attack-damage-type-${index}`"
        /></label>
      </div>
    </div>
    <UButton
      class="mt-small"
      color="neutral"
      variant="outline"
      type="button"
      data-testid="add-attack"
      @click="addAttack"
      >Add attack</UButton
    >
  </SheetSection>
</template>

<style scoped>
.attack {
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  padding: var(--spacing-small);
  margin-top: var(--spacing-small);
}
.attack-header {
  display: flex;
  align-items: end;
  gap: var(--spacing-small);
}
.attack-header label {
  flex: 1;
}
.attack-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: var(--spacing-small);
  margin-top: var(--spacing-small);
}
label {
  display: grid;
  gap: var(--sheet-tight);
  min-width: 0;
  font-size: var(--sheet-label-size);
  color: var(--ui-text-muted);
}
input,
select {
  width: 100%;
  min-width: 0;
  color: var(--ui-text);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  padding: var(--sheet-tight) var(--spacing-small);
  font-size: 0.875rem;
}
</style>
