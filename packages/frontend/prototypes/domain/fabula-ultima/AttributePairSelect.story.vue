<script setup lang="ts">
import AttributePairSelect from "../../../src/shared/design-system/domain/AttributePairSelect.vue";
import type { AttributeChoice } from "../../../src/shared/design-system/domain/types";
function initialState() {
  return {
    attributes: ["DEX", "MIG"] as [AttributeChoice, AttributeChoice],
    disabled: false,
    allowEmpty: true,
  };
}
</script>
<template>
  <Story title="Domain/Fabula Ultima/Attribute pair" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <AttributePairSelect
            class="max-w-md"
            :attributes="state.attributes"
            :disabled="state.disabled"
            :allow-empty="state.allowEmpty"
            @change="(index, value) => (state.attributes[index] = value)"
          />
          <p class="mt-medium text-muted">
            Weapon and NPC attack attributes. Both slots may use the same attribute.
          </p>
        </div></UApp
      >
    </template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.disabled" title="Disabled"
    /></template>
  </Story>
</template>
