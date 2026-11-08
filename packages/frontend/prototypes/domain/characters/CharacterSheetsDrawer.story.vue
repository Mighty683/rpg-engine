<script setup lang="ts">
import CharacterSheetsDrawer from "../../../src/modules/game-table/CharacterSheetsDrawer.vue";
import CharacterSheet from "../../../src/modules/characters/sheet/CharacterSheet.vue";
import { makeCharacter, sheetMaximum, baseDefense, defenseDetails } from "../fixtures";

const tabs = [
  { label: "Rowan Ash", value: "rowan" },
  { label: "Nera Vale", value: "nera" },
];

function initialState() {
  const rowan = makeCharacter();
  const nera = makeCharacter();
  nera.id = "nera";
  nera.identity = { name: "Nera Vale", theme: "Curiosity" };
  const overrides: Record<string, Record<keyof typeof sheetMaximum, number | null>> = {
    rowan: { HP: null, MP: null, IP: null },
    nera: { HP: null, MP: null, IP: null },
  };
  return {
    open: false,
    selectedId: "rowan",
    sheets: { rowan, nera },
    overrides,
    readOnly: false,
  };
}
</script>

<template>
  <Story title="Domain/Characters/Character sheets drawer" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <CharacterSheetsDrawer
            v-model:open="state.open"
            v-model:selected-id="state.selectedId"
            :tabs="tabs"
          >
            <template #sheet="{ characterId }">
              <CharacterSheet
                :key="characterId"
                :character="characterId === 'nera' ? state.sheets.nera : state.sheets.rowan"
                :read-only="state.readOnly"
                :maximum="sheetMaximum"
                :maximum-overrides="state.overrides[characterId]!"
                :base-defense="baseDefense"
                :defense-details="defenseDetails"
                @override-maximum="
                  (resource, value) => (state.overrides[characterId]![resource] = value)
                "
              />
            </template>
          </CharacterSheetsDrawer>
        </div>
      </UApp>
    </template>
    <template #controls="{ state }">
      <HstCheckbox v-model="state.open" title="Drawer open" />
      <HstCheckbox v-model="state.readOnly" title="Read-only" />
      <HstSelect
        v-model="state.selectedId"
        title="Selected character"
        :options="{ rowan: 'Rowan Ash', nera: 'Nera Vale' }"
      />
    </template>
  </Story>
</template>
