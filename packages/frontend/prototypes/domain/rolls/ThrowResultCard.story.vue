<script setup lang="ts">
import ThrowResultCard from "../../../src/modules/game-table/ThrowResultCard.vue";
import { makeThrow } from "../fixtures";

function initialState() {
  return { kind: "weapon-accuracy" as Parameters<typeof makeThrow>[0], canRemove: true };
}
</script>

<template>
  <Story title="Domain/Rolls/Throw result card" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <ol class="max-w-xl">
            <ThrowResultCard :entry="makeThrow(state.kind, state.canRemove)" />
          </ol>
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect
        v-model="state.kind"
        title="Roll kind"
        :options="['weapon-accuracy', 'opposed-check', 'free']" /><HstCheckbox
        v-model="state.canRemove"
        title="Can remove"
    /></template>
  </Story>
</template>
