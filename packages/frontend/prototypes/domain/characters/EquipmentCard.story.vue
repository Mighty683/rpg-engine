<script setup lang="ts">
import EquipmentCard from "../../../src/modules/characters/sheet/equipment/EquipmentCard.vue";
import type { NamedEntry } from "../../../src/modules/characters/sheet/types";
import { equipment } from "../fixtures";

function initialState() {
  return { entry: structuredClone<NamedEntry>(equipment), open: false, locked: false };
}
</script>

<template>
  <Story title="Domain/Characters/Equipment card" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <EquipmentCard
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
      <HstCheckbox v-model="state.locked" title="Locked" /><HstNumber
        v-model="state.entry.price"
        title="Price" /><HstCheckbox
        v-if="state.entry.weapon"
        v-model="state.entry.weapon.equipped"
        title="Equipped"
    /></template>
  </Story>
</template>
