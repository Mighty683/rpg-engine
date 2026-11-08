<script setup lang="ts">
import HistoryPanel from "../../../src/modules/game-table/HistoryPanel.vue";
import { makeThrow } from "../fixtures";

const throws = [makeThrow("weapon-accuracy"), makeThrow("opposed-check"), makeThrow("free")];
function initialState() {
  return { view: "populated", hasOlder: false };
}
</script>

<template>
  <Story title="Domain/Rolls/Throw history" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <HistoryPanel
            class="max-w-xl"
            :throws="state.view === 'populated' ? throws : []"
            :is-loading="state.view === 'loading'"
            :is-error="state.view === 'error'"
            :has-older="state.hasOlder"
            highlight-id=""
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect
        v-model="state.view"
        title="History state"
        :options="['populated', 'empty', 'loading', 'error']" /><HstCheckbox
        v-model="state.hasOlder"
        title="Has older throws"
    /></template>
  </Story>
</template>
