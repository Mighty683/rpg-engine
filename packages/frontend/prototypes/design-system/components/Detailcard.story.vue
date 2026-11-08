<script setup lang="ts">
import DetailCard from "../../../src/shared/design-system/DetailCard.vue";
import { ref } from "vue";
const notes = ref("A short description.");
function initialState() {
  return { title: "Example item", locked: false };
}
</script>
<template>
  <Story title="Design system/Components/Detail card" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <DetailCard
            :title="state.title"
            :notes="notes"
            :locked="state.locked"
            remove-label="Remove item"
            ><label
              >Notes
              <input
                v-model="notes"
                class="block w-full rounded-panel border border-default bg-default p-small" /></label
          ></DetailCard></div
      ></UApp>
    </template>
    <template #controls="{ state }">
      <HstText v-model="state.title" title="Title" />
      <HstCheckbox v-model="state.locked" title="Locked" />
    </template>
  </Story>
</template>
