<script setup lang="ts">
import NpcCard from "../../../src/modules/npcs/NpcCard.vue";
import { npc } from "./fixtures";

function initialState() {
  return { redacted: false, canEdit: true, canRoll: true, showNotes: true };
}
</script>

<template>
  <Story title="Domain/NPCs/Table mini sheet" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <div class="max-w-md">
            <NpcCard
              :npc="npc"
              :redacted="state.redacted"
              :can-edit="state.canEdit"
              :can-roll="state.canRoll"
              :show-notes="state.showNotes"
            />
          </div></div
      ></UApp>
    </template>
    <template #controls="{ state }">
      <HstCheckbox v-model="state.redacted" title="Redacted" />
      <HstCheckbox v-model="state.canEdit" title="Can edit" />
      <HstCheckbox v-model="state.canRoll" title="Can roll" />
      <HstCheckbox v-model="state.showNotes" title="Show notes" />
    </template>
  </Story>
</template>
