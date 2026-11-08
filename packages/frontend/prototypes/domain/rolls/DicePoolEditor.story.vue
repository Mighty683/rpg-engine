<script setup lang="ts">
import DicePoolEditor from "../../../src/modules/game-table/DicePoolEditor.vue";

function initialState() {
  return { dice: [8], modifier: "0", opposing: false };
}
</script>

<template>
  <Story title="Domain/Rolls/Dice pool editor" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <DicePoolEditor
            v-model:dice="state.dice"
            v-model:modifier="state.modifier"
            :sizes="[4, 6, 8, 10, 12, 20]"
            :opposing="state.opposing"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.opposing" title="Opposing dice" /><HstText
        v-model="state.modifier"
        title="Modifier"
    /></template>
  </Story>
</template>
