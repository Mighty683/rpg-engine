<script setup lang="ts">
import SheetSection from "../../../../shared/design-system/SheetSection.vue";
import AttributeField from "./AttributeField.vue";
import type { Character } from "../types";
defineProps<{ attributes: Character["attributes"] }>();
const help = {
  DEX: "Dexterity measures agility and is the usual base for Defense.",
  INS: "Insight measures awareness and is the base for Magic Defense.",
  MIG: "Might measures physical strength and contributes to maximum HP.",
  WLP: "Willpower measures resolve and contributes to maximum MP.",
};
</script>

<template>
  <SheetSection
    ><template #heading>◈ ATTRIBUTES</template><template #hint>BASE DICE</template>
    <div class="grid">
      <AttributeField
        v-for="attribute in ['DEX', 'INS', 'MIG', 'WLP'] as const"
        :key="attribute"
        v-model="attributes[attribute]"
        :label="attribute"
        :help="help[attribute]"
      /></div
  ></SheetSection>
</template>

<style scoped>
.grid {
  display: grid;
  gap: var(--spacing-small);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: var(--sheet-tight);
}
@media (max-width: 420px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
