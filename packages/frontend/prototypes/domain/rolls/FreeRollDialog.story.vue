<script setup lang="ts">
import FreeRollDialog from "../../../src/modules/game-table/FreeRollDialog.vue";
import { partyMember } from "../fixtures";

function initialState() {
  return {
    role: "GM" as "GM" | "Player",
    open: false,
    pending: false,
    error: "",
    playerHasActive: true,
    draft: { characterId: "gm", dice: [8], modifier: "0", note: "" },
    opponent: { dice: [], modifier: "0" },
  };
}
</script>

<template>
  <Story title="Domain/Rolls/Free roll dialog" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <UButton @click="state.open = true">Open free roll dialog</UButton>
          <FreeRollDialog
            v-if="state.open"
            :draft="state.draft"
            v-model:opponent="state.opponent"
            :role="state.role"
            :roll-as-options="[
              { label: 'GM', value: 'gm' },
              { label: partyMember.name, value: partyMember.id },
            ]"
            :player-active-name="partyMember.name"
            :player-has-active="state.playerHasActive"
            :pending="state.pending"
            :error="state.error"
            @update:character="state.draft.characterId = $event"
            @cancel="state.open = false"
            @submit="state.open = false"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect v-model="state.role" title="Role" :options="['GM', 'Player']" /><HstCheckbox
        v-model="state.open"
        title="Open" />
      <HstCheckbox v-model="state.pending" title="Pending" />
      <HstCheckbox v-model="state.playerHasActive" title="Player has active character" /><HstText
        v-model="state.error"
        title="Validation message"
    /></template>
  </Story>
</template>
