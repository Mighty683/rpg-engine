<script setup lang="ts">
import CharacterSheet from "../../../src/modules/characters/sheet/CharacterSheet.vue";
import { makeCharacter, sheetMaximum, baseDefense, defenseDetails } from "../fixtures";

function initialState() {
  return {
    character: makeCharacter(),
    readOnly: false,
    maximumOverrides: { HP: null, MP: null, IP: null } as Record<
      keyof typeof sheetMaximum,
      number | null
    >,
  };
}
</script>

<template>
  <Story title="Domain/Characters/Character sheet" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <CharacterSheet
            :character="state.character"
            controller="Nera"
            :read-only="state.readOnly"
            :maximum="sheetMaximum"
            :maximum-overrides="state.maximumOverrides"
            :base-defense="baseDefense"
            :defense-details="defenseDetails"
            @override-maximum="(resource, value) => (state.maximumOverrides[resource] = value)"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.readOnly" title="Read-only" /><HstCheckbox
        v-model="state.character.editingLocked"
        title="Editing locked"
    /></template>
  </Story>
</template>
