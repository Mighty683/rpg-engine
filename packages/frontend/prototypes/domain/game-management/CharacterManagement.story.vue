<script setup lang="ts">
import CharacterManagement from "../../../src/modules/games/CharacterManagement.vue";
import { characterSummary, members } from "../fixtures";

function initialState() {
  return {
    role: "GM" as "GM" | "Player",
    empty: false,
    pending: false,
    characters: [
      { ...characterSummary },
      {
        ...characterSummary,
        id: "nera",
        name: "Nera Vale",
        controllerMembershipId: null,
        controllerName: null,
        canEdit: false,
        active: false,
      },
    ],
  };
}
</script>

<template>
  <Story title="Domain/Game management/Character roster" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <CharacterManagement
            :characters="state.empty ? [] : state.characters"
            :members="members"
            :role="state.role"
            :pending="state.pending"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }">
      <HstSelect v-model="state.role" title="Role" :options="['GM', 'Player']" />
      <HstCheckbox v-model="state.empty" title="Empty roster" />
      <HstCheckbox v-model="state.pending" title="Pending update" />
    </template>
  </Story>
</template>
