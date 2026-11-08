<script setup lang="ts">
import ClassCard from "../../../src/modules/characters/sheet/entries/ClassCard.vue";
import { guardian } from "../fixtures";

function initialState() {
  return { entry: structuredClone(guardian), open: false, locked: false };
}
</script>

<template>
  <Story title="Domain/Characters/Class card" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <ClassCard
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
