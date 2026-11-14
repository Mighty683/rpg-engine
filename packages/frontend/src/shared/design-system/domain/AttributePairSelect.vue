<script setup lang="ts">
import { computed } from "vue";
import type { SelectOption } from "../base/types";
import LabeledSelect from "../base/LabeledSelect.vue";
import EditorFieldGrid from "../base/EditorFieldGrid.vue";
import type { AttributeChoice, FabulaAttribute } from "./types";

const props = defineProps<{
  attributes: [AttributeChoice, AttributeChoice];
  disabled?: boolean;
  allowEmpty?: boolean;
  testIds?: [string, string];
  context?: string;
}>();
defineEmits<{ change: [index: 0 | 1, value: AttributeChoice] }>();
const attributes: FabulaAttribute[] = ["DEX", "INS", "MIG", "WLP"];
const items = computed<SelectOption<FabulaAttribute | "unselected">[]>(() => [
  ...(props.allowEmpty ? [{ label: "Select attribute", value: "unselected" as const }] : []),
  ...attributes.map((value) => ({ label: value, value })),
]);
</script>

<template>
  <EditorFieldGrid>
    <LabeledSelect
      v-for="index in [0, 1] as const"
      :key="index"
      :label="`Attribute ${index + 1}`"
      :model-value="props.attributes[index] || (allowEmpty ? 'unselected' : undefined)"
      :items="items"
      placeholder="Select attribute"
      :disabled="disabled"
      :data-testid="testIds?.[index]"
      :aria-label="context ? `Attribute ${index + 1} for ${context}` : undefined"
      @update:model-value="$emit('change', index, $event === 'unselected' ? '' : $event!)"
    >
      <template #item-label="{ item }">
        <span :data-testid="testIds ? `${testIds[index]}-option-${item.value}` : undefined">{{
          item.label
        }}</span>
      </template>
    </LabeledSelect>
  </EditorFieldGrid>
</template>
