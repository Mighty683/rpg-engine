<script setup lang="ts">
import NpcSheet from "../../../src/modules/npcs/NpcSheet.vue";
import { npc } from "./fixtures";

function initialState() {
  return { readOnly: false, create: false, npc: structuredClone(npc) };
}
</script>

<template>
  <Story title="Domain/NPCs/NPC sheet" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <NpcSheet
            :npc="state.create ? null : state.npc"
            :read-only="state.readOnly"
            @save="(saved) => (state.npc = saved)"
          /></div
      ></UApp>
    </template>
    <template #controls="{ state }">
      <HstCheckbox v-model="state.create" title="New NPC" />
      <HstCheckbox v-model="state.readOnly" title="Read-only" />
    </template>
  </Story>
</template>
