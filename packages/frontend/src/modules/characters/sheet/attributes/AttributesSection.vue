<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
import SheetSection from "../../../../shared/design-system/domain/SheetSection.vue";
import AttributeField from "./AttributeField.vue";
import type { Attribute, Character } from "../types";
defineProps<{
  attributes: Character["attributes"];
  readOnly?: boolean;
  currentDice?: Record<Attribute, number>;
}>();
const help = {
  DEX: tr("ui.dexterityMeasuresAgilityAndIsTheUsualBaseFor"),
  INS: tr("ui.insightMeasuresAwarenessAndIsTheBaseForMagic"),
  MIG: tr("ui.mightMeasuresPhysicalStrengthAndContributesToMaximumHp"),
  WLP: tr("ui.willpowerMeasuresResolveAndContributesToMaximumMp"),
};
</script>

<template>
  <SheetSection class="attributes"
    ><template #heading>{{ tr("ui.attributes") }}</template
    ><template #hint>{{ tr("ui.baseDice") }}</template>
    <div class="grid">
      <AttributeField
        v-for="attribute in ['DEX', 'INS', 'MIG', 'WLP'] as const"
        :key="attribute"
        v-model="attributes[attribute]"
        :label="attribute"
        :current-die="currentDice?.[attribute]"
        :help="help[attribute]"
        :disabled="readOnly"
      /></div
  ></SheetSection>
</template>

<style scoped>
.attributes {
  display: flex;
  flex-direction: column;
}
.grid {
  display: grid;
  flex: 1;
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
