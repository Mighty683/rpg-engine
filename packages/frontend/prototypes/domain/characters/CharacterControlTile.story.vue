<script setup lang="ts">
import CharacterControlTile from "../../../src/modules/games/CharacterControlTile.vue";
import { characterSummary, members } from "../fixtures";

function initialState() {
  return { character: { ...characterSummary }, role: "GM" as "GM" | "Player", pending: false };
}
</script>

<template>
  <Story title="Domain/Characters/Character control tile" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <CharacterControlTile
            class="max-w-md"
            :character="state.character"
            :role="state.role"
            :members="members"
            :pending="state.pending"
            @set-active="state.character.active = $event"
            @assign="state.character.controllerMembershipId = $event"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect v-model="state.role" title="Role" :options="['GM', 'Player']" /><HstCheckbox
        v-model="state.pending"
        title="Pending" /><HstCheckbox
        v-model="state.character.active"
        title="Active" /><HstCheckbox v-model="state.character.canEdit" title="Can edit"
    /></template>
  </Story>
</template>
