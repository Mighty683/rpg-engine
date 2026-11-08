<script setup lang="ts">
import PartyCharacterCard from "../../../src/modules/game-table/PartyCharacterCard.vue";
import { partyMember, sword } from "../fixtures";

function initialState() {
  return { canRoll: true, hp: 28, hasWeapon: true, weaponReady: true };
}
</script>

<template>
  <Story title="Domain/Characters/Table mini sheet" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <ul class="max-w-md">
            <PartyCharacterCard
              :member="{
                ...partyMember,
                canRoll: state.canRoll,
                resources: { ...partyMember.resources, hp: state.hp },
                weapons: state.hasWeapon ? [{ ...sword, ready: state.weaponReady }] : [],
              }"
            />
          </ul>
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.canRoll" title="Can roll" />
      <HstCheckbox v-model="state.hasWeapon" title="Has a weapon" />
      <HstCheckbox v-model="state.weaponReady" title="Weapon ready" /><HstSlider
        v-model="state.hp"
        title="HP"
        :min="0"
        :max="35"
    /></template>
  </Story>
</template>
