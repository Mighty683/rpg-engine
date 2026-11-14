<script setup lang="ts">
import DieButton from "../../../src/shared/design-system/domain/DieButton.vue";

function initialState() {
  return { sides: 8, opposing: false, disabled: false };
}
</script>
<template>
  <Story title="Domain/Fabula Ultima/Die button" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <DieButton
            :sides="state.sides"
            :opposing="state.opposing"
            :disabled="state.disabled"
            :aria-label="`Roll d${state.sides}`"
          /></div
      ></UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect v-model="state.sides" title="Size" :options="[4, 6, 8, 10, 12, 20]" /><HstCheckbox
        v-model="state.opposing"
        title="Opposing" /><HstCheckbox v-model="state.disabled" title="Disabled"
    /></template>
  </Story>
</template>
