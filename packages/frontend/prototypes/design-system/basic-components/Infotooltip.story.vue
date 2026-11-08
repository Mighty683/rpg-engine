<script setup lang="ts">
import InfoTooltip from "../../../src/shared/design-system/InfoTooltip.vue";

function initialState() {
  return { text: "Helpful information" };
}
</script>
<template>
  <Story title="Design system/Basic components/Info tooltip" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <InfoTooltip label="About this field" :text="state.text" /></div
      ></UApp>
    </template>
    <template #controls="{ state }"><HstText v-model="state.text" title="Help text" /></template>
  </Story>
</template>
