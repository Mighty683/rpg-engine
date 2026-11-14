<script setup lang="ts">
import LabeledInput from "../../../../shared/design-system/base/LabeledInput.vue";
import EditorFieldGrid from "../../../../shared/design-system/base/EditorFieldGrid.vue";
import AttributePairSelect from "../../../../shared/design-system/domain/AttributePairSelect.vue";
import type { Attribute, NamedEntry } from "../types";
defineProps<{ entry: NamedEntry }>();
defineEmits<{
  equipped: [value: boolean];
  attribute: [index: 0 | 1, value: Attribute | ""];
  accuracy: [value: number | null];
}>();
</script>
<template>
  <label v-if="entry.itemType === 'weapon' && entry.weapon" class="weapon-equipped"
    ><input
      :checked="entry.weapon.equipped"
      @change="$emit('equipped', ($event.target as HTMLInputElement).checked)"
      type="checkbox"
      :data-testid="`equip-weapon-${entry.id}`"
      :aria-label="`Equip ${entry.name}`"
    />
    Equipped</label
  >
  <EditorFieldGrid v-if="entry.itemType === 'weapon' && entry.weapon" class="mt-small">
    <AttributePairSelect
      allow-empty
      class="col-span-full"
      :attributes="entry.weapon.attributes"
      :context="entry.name"
      :test-ids="['weapon-attribute-1', 'weapon-attribute-2']"
      @change="(index, value) => $emit('attribute', index, value)"
    />
    <LabeledInput
      label="Accuracy bonus"
      :model-value="entry.weapon.accuracyBonus ?? undefined"
      type="number"
      :aria-label="`Accuracy bonus for ${entry.name}`"
      data-testid="weapon-accuracy-bonus"
      placeholder="—"
      @input="
        $emit(
          'accuracy',
          ($event.target as HTMLInputElement).value === ''
            ? null
            : ($event.target as HTMLInputElement).valueAsNumber,
        )
      "
    />
  </EditorFieldGrid>
</template>
<style scoped>
.weapon-equipped {
  display: flex;
  align-items: center;
  gap: var(--spacing-small);
  margin-top: var(--spacing-small);
}
</style>
