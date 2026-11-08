<script setup lang="ts">
import RollDialog from "../../../src/modules/game-table/RollDialog.vue";
import { partyMember, sword } from "../fixtures";
import type { RollDraft } from "../../../src/modules/game-table/RollDialog.vue";

function makeDraft(mode: RollDraft["mode"]): RollDraft {
  const weapon = mode === "weapon";
  return {
    mode,
    character: partyMember,
    weaponId: weapon ? sword.id : null,
    weaponName: weapon ? sword.name : "",
    weaponBonus: weapon ? 1 : 0,
    first: "DEX",
    second: weapon ? "MIG" : null,
    dice: { ...partyMember.baseDice },
    modifier: "0",
    note: "",
  };
}
function initialState() {
  return {
    mode: "attribute",
    open: false,
    pending: false,
    error: "",
    attribute: makeDraft("attribute"),
    weapon: makeDraft("weapon"),
    opponent: { dice: [], modifier: "0" },
  };
}
</script>

<template>
  <Story title="Domain/Rolls/Attribute and weapon roll dialog" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <UButton @click="state.open = true">Open roll dialog</UButton>
          <RollDialog
            v-if="state.open"
            :draft="state.mode === 'weapon' ? state.weapon : state.attribute"
            v-model:opponent="state.opponent"
            :pending="state.pending"
            :error="state.error"
            @cancel="state.open = false"
            @submit="state.open = false"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect
        v-model="state.mode"
        title="Roll type"
        :options="['attribute', 'weapon']" /><HstCheckbox v-model="state.open" title="Open" />
      <HstCheckbox v-model="state.pending" title="Pending" /><HstText
        v-model="state.error"
        title="Validation message"
    /></template>
  </Story>
</template>
