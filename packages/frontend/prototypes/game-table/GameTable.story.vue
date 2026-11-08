<script setup lang="ts">
import GameTablePrototype from "./GameTablePrototype.vue";

function initialState() {
  return { role: "GM" as "GM" | "Player" };
}
</script>

<template>
  <Story title="Prototypes/Game Table" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default text-default">
          <GameTablePrototype :role="state.role" /></div
      ></UApp>
    </template>
    <template #controls="{ state }">
      <HstSelect v-model="state.role" title="Preview role" :options="['GM', 'Player']" />
    </template>
  </Story>
</template>
