<script setup lang="ts">
import WeaponRollButton from "../../../src/modules/game-table/WeaponRollButton.vue";
import { partyMember, sword } from "../fixtures";

function initialState() {
  return { ready: true, canRoll: true };
}
</script>

<template>
  <Story title="Domain/Rolls/Weapon roll button" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <WeaponRollButton
            class="max-w-sm"
            :weapon="{
              ...sword,
              ready: state.ready,
              accuracyDice: state.ready ? sword.accuracyDice : [null, null],
            }"
            :base-dice="partyMember.baseDice"
            :character-name="partyMember.name"
            :can-roll="state.canRoll"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.ready" title="Weapon ready" />
      <HstCheckbox v-model="state.canRoll" title="Can roll"
    /></template>
  </Story>
</template>
