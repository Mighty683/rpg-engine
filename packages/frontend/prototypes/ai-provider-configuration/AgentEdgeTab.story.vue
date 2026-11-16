<script setup lang="ts">
import AgentTablePreview from "./AgentTablePreview.vue";

function initialState() {
  return { available: true };
}
</script>

<template>
  <Story title="Prototypes/Agent on the game table" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <AgentTablePreview :available="state.available" />
      </UApp>
    </template>
    <template #controls="{ state }">
      <HstCheckbox v-model="state.available" title="Agent available" />
    </template>
  </Story>
</template>
