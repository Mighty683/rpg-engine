<script setup lang="ts">
import OpposedSetup from "../../../src/modules/game-table/OpposedSetup.vue";

function initialState() {
  return { opponent: { dice: [8], modifier: "0" }, showPool: true };
}
</script>

<template>
  <Story title="Domain/Rolls/Opposed roll setup" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <OpposedSetup v-model="state.opponent" :show-pool="state.showPool" />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.showPool" title="Show selected dice"
    /></template>
  </Story>
</template>
