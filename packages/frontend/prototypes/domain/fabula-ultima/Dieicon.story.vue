<script setup lang="ts">
import DieIcon from "../../../src/shared/design-system/domain/DieIcon.vue";

function initialState() {
  return { sides: 8 };
}
</script>
<template>
  <Story title="Domain/Fabula Ultima/Die icon" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <DieIcon :sides="state.sides" /></div
      ></UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect v-model="state.sides" title="Size" :options="[4, 6, 8, 10, 12, 20]"
    /></template>
  </Story>
</template>
