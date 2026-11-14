<script setup lang="ts">
import LabeledSelect from "../../../src/shared/design-system/base/LabeledSelect.vue";
function initialState() {
  return { value: "personal", disabled: false, invalid: false };
}
const options = [
  { label: "Personal", value: "personal" },
  { label: "Shared", value: "shared" },
];
</script>
<template>
  <Story title="Design system/Base/Labeled select" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <LabeledSelect
            v-model="state.value"
            label="Visibility"
            :items="options"
            :disabled="state.disabled"
            :error="state.invalid ? 'Choose visibility' : undefined"
            description="Choose who can see this item."
            class="max-w-xs"
          /></div
      ></UApp>
    </template>
    <template #controls="{ state }">
      <HstCheckbox v-model="state.disabled" title="Disabled" />
      <HstCheckbox v-model="state.invalid" title="Invalid" />
    </template>
  </Story>
</template>
