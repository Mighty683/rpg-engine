<script setup lang="ts">
import PartyPanel from "../../../src/modules/game-table/PartyPanel.vue";
import type { PartyCharacter } from "../../../src/modules/game-table/types";
import { partyMember, sword } from "../fixtures";
import NpcCard from "../../../src/modules/npcs/NpcCard.vue";
import { npc } from "../npcs/fixtures";

const secondMember: PartyCharacter = {
  ...partyMember,
  id: "nera",
  name: "Nera Vale",
  classes: ["Elementalist", "Orator"],
  resources: { hp: 16, mp: 32, ip: 3, fabula: 2 },
  canRoll: false,
  weapons: [],
};

function initialState() {
  return { view: "Populated", needsWeaponSetup: false, showWeaponHint: false };
}
</script>

<template>
  <Story title="Domain/Characters/Active party" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <PartyPanel
            class="max-w-3xl"
            :party="
              state.view === 'Populated'
                ? [
                    { ...partyMember, weapons: [{ ...sword, ready: !state.needsWeaponSetup }] },
                    secondMember,
                  ]
                : []
            "
            :is-loading="state.view === 'Loading'"
            :is-error="state.view === 'Error'"
            :weapon-hint="
              state.showWeaponHint ? { character: partyMember, weaponName: sword.name } : null
            "
            @retry="state.view = 'Populated'"
            @needs-weapon-setup="state.showWeaponHint = true"
            @open-sheet="state.showWeaponHint = false"
          >
            <NpcCard v-if="state.view === 'Populated'" :npc="npc" />
          </PartyPanel>
        </div>
      </UApp>
    </template>
    <template #controls="{ state }">
      <HstSelect
        v-model="state.view"
        title="Party state"
        :options="['Populated', 'Empty', 'Loading', 'Error']"
      />
      <HstCheckbox v-model="state.needsWeaponSetup" title="Weapon needs setup" />
      <HstCheckbox v-model="state.showWeaponHint" title="Show weapon setup hint" />
    </template>
  </Story>
</template>
