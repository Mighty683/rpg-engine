<script setup lang="ts">
import NpcCard from "./NpcCard.vue";
import { allNpcs, goblinSoldier } from "./fixtures";
import type { Npc } from "./types";

function initialState() {
  return {
    selectedNpcId: goblinSoldier.id,
    hp: goblinSoldier.hp.current,
  };
}
</script>

<template>
  <Story title="Prototypes/NPCs and enemies/NPC card" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <div class="max-w-xl">
            <NpcCard
              :npc="
                {
                  ...(allNpcs.find((n) => n.id === state.selectedNpcId) ?? allNpcs[0]),
                  hp: {
                    current: state.hp,
                    max: (allNpcs.find((n) => n.id === state.selectedNpcId) ?? allNpcs[0]).hp.max,
                  },
                } as Npc
              "
            />
          </div>
        </div>
      </UApp>
    </template>
    <template #controls="{ state }">
      <HstSelect
        v-model="state.selectedNpcId"
        title="NPC"
        :options="allNpcs.map((n) => ({ label: n.name, value: n.id }))"
      />
      <HstSlider
        v-model="state.hp"
        title="Current HP"
        :min="0"
        :max="(allNpcs.find((n) => n.id === state.selectedNpcId) ?? allNpcs[0]).hp.max"
      />
    </template>
  </Story>
</template>
