<script setup lang="ts">
import DefenseSection from "../../../src/modules/characters/sheet/defense/DefenseSection.vue";
import { makeCharacter, baseDefense, defenseDetails } from "../fixtures";

function initialState() {
  return { overrides: makeCharacter().overrides };
}
</script>

<template>
  <Story title="Domain/Characters/Defense section" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <DefenseSection
            :overrides="state.overrides"
            :calculated="baseDefense"
            :details="defenseDetails"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstNumber v-model="state.overrides.DEF" title="Defense override"
    /></template>
  </Story>
</template>
