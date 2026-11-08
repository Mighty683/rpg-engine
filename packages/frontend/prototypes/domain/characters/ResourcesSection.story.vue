<script setup lang="ts">
import ResourcesSection from "../../../src/modules/characters/sheet/resources/ResourcesSection.vue";
import { makeCharacter, sheetMaximum } from "../fixtures";

function initialState() {
  return {
    current: makeCharacter().current,
    overrides: { HP: null, MP: null, IP: null } as Record<keyof typeof sheetMaximum, number | null>,
  };
}
</script>

<template>
  <Story title="Domain/Characters/Resources section" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <ResourcesSection
            :current="state.current"
            :maximum="sheetMaximum"
            :maximum-overrides="state.overrides"
            @override="(resource, value) => (state.overrides[resource] = value)"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstNumber v-model="state.current.HP" title="Current HP" /><HstNumber
        v-model="state.overrides.HP"
        title="Maximum HP override"
    /></template>
  </Story>
</template>
