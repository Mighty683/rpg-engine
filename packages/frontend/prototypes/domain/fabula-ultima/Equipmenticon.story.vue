<script setup lang="ts">
import EquipmentIcon from "../../../src/shared/design-system/domain/EquipmentIcon.vue";

function initialState() {
  return { kind: "armor" as "armor" | "other" | "equipped" };
}
</script>
<template>
  <Story title="Domain/Fabula Ultima/Equipment icon" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <EquipmentIcon :kind="state.kind" /></div
      ></UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect v-model="state.kind" title="Kind" :options="['armor', 'other', 'equipped']"
    /></template>
  </Story>
</template>
