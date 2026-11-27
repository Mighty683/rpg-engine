<script setup lang="ts">
import { tr } from "../../shared/i18n";
import { newUuid } from "../../shared/uuid";
import EditorFieldGrid from "../../shared/design-system/base/EditorFieldGrid.vue";
import LabeledSelect from "../../shared/design-system/base/LabeledSelect.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import SheetSection from "../../shared/design-system/domain/SheetSection.vue";
import AttributePairSelect from "../../shared/design-system/domain/AttributePairSelect.vue";
import type { NpcAttack } from "./types";

const props = defineProps<{ attacks: NpcAttack[] }>();

function addAttack() {
  props.attacks.push({
    id: newUuid(),
    name: tr("ui.newAttack"),
    range: "melee",
    attributes: ["DEX", "MIG"],
    damageBonus: 5,
    damageType: "physical",
  });
}
</script>

<template>
  <SheetSection>
    <template #heading>{{ tr("ui.attacks") }}</template>
    <p v-if="!attacks.length" class="text-label text-muted">{{ tr("ui.noAttacksYet") }}</p>
    <div
      v-for="(attack, index) in attacks"
      :key="attack.id"
      class="attack"
      :data-testid="`attack-editor-${index}`"
    >
      <div class="attack-header">
        <LabeledInput
          :label="tr('ui.name')"
          v-model="attack.name"
          class="min-w-0 flex-1"
          :data-testid="`attack-name-${index}`"
        />
        <UButton
          color="error"
          variant="outline"
          type="button"
          :data-testid="`remove-attack-${index}`"
          :aria-label="tr('ui.removeValue12', { value1: attack.name })"
          @click="attacks.splice(index, 1)"
          >{{ tr("ui.remove") }}</UButton
        >
      </div>
      <EditorFieldGrid class="mt-small">
        <LabeledSelect
          :label="tr('ui.reach')"
          v-model="attack.range"
          :items="[
            { label: tr('ui.melee'), value: 'melee' },
            { label: tr('ui.ranged'), value: 'ranged' },
          ]"
          :data-testid="`attack-range-${index}`"
        />
        <AttributePairSelect
          class="col-span-full"
          :attributes="attack.attributes"
          :context="attack.name"
          :test-ids="[`attack-attribute-${index}-0`, `attack-attribute-${index}-1`]"
          @change="
            (attributeIndex, value) => {
              if (value) attack.attributes[attributeIndex] = value;
            }
          "
        />
        <LabeledInput
          :label="tr('ui.damageBonus')"
          v-model.number="attack.damageBonus"
          type="number"
          :data-testid="`attack-damage-${index}`"
        />
        <LabeledInput
          :label="tr('ui.damageType')"
          v-model="attack.damageType"
          :data-testid="`attack-damage-type-${index}`"
        />
      </EditorFieldGrid>
    </div>
    <UButton
      class="mt-small"
      color="neutral"
      variant="outline"
      type="button"
      data-testid="add-attack"
      @click="addAttack"
      >{{ tr("ui.addAttack") }}</UButton
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
</style>
