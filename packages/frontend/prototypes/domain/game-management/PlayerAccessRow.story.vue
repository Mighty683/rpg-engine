<script setup lang="ts">
import PlayerAccessRow from "../../../src/modules/games/PlayerAccessRow.vue";

function initialState() {
  return { removed: false, pending: false };
}
</script>

<template>
  <Story title="Domain/Game management/Player access row" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <ul class="max-w-xl">
            <PlayerAccessRow
              name="Nera"
              :removed="state.removed"
              :pending="state.pending"
              @remove="state.removed = true"
              @restore="state.removed = false"
            />
          </ul>
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.removed" title="Access removed" />
      <HstCheckbox v-model="state.pending" title="Pending"
    /></template>
  </Story>
</template>
