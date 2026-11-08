<script setup lang="ts">
import SkillCard from "../../../src/modules/characters/sheet/entries/SkillCard.vue";
import { skill } from "../fixtures";

function initialState() {
  return { entry: structuredClone(skill), open: false, locked: false };
}
</script>

<template>
  <Story title="Domain/Characters/Skill card" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <SkillCard
            class="max-w-md"
            v-model:open="state.open"
            :entry="state.entry"
            :locked="state.locked"
            @update:entry="state.entry = $event"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstText v-model="state.entry.name" title="Name" /><HstCheckbox
        v-model="state.open"
        title="Editor open" />
      <HstCheckbox v-model="state.locked" title="Locked"
    /></template>
  </Story>
</template>
