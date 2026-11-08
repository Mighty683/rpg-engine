<script setup lang="ts">
import SheetSection from "../../../src/shared/design-system/SheetSection.vue";

function initialState() {
  return { heading: "Attributes", hint: "Optional hint" };
}
</script>
<template>
  <Story title="Design system/Basic components/Sheet section" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <SheetSection
            ><template #heading>{{ state.heading }}</template
            ><template #hint>{{ state.hint }}</template>
            <p>Section content.</p></SheetSection
          >
        </div></UApp
      >
    </template>
    <template #controls="{ state }"
      ><HstText v-model="state.heading" title="Heading" /><HstText
        v-model="state.hint"
        title="Hint"
    /></template>
  </Story>
</template>
