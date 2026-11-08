<script setup lang="ts">
import AttributeRollButton from "../../../src/modules/game-table/AttributeRollButton.vue";

function initialState() {
  return { attribute: "DEX" as "DEX" | "INS" | "MIG" | "WLP", sides: 8, canRoll: true };
}
</script>

<template>
  <Story title="Domain/Rolls/Attribute roll button" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <AttributeRollButton
            :attribute="state.attribute"
            :sides="state.sides"
            character-name="Rowan Ash"
            :can-roll="state.canRoll"
          />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect
        v-model="state.attribute"
        title="Attribute"
        :options="['DEX', 'INS', 'MIG', 'WLP']" /><HstSelect
        v-model="state.sides"
        title="Die size"
        :options="[6, 8, 10, 12]" /><HstCheckbox v-model="state.canRoll" title="Can roll"
    /></template>
  </Story>
</template>
