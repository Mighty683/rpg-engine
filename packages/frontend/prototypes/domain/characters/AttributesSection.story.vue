<script setup lang="ts">
import AttributesSection from "../../../src/modules/characters/sheet/attributes/AttributesSection.vue";
import { makeCharacter } from "../fixtures";

function initialState() {
  return { attributes: makeCharacter().attributes };
}
</script>

<template>
  <Story title="Domain/Characters/Attributes section" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <AttributesSection :attributes="state.attributes" />
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect v-model="state.attributes.DEX" title="DEX" :options="['6', '8', '10', '12']" />
      <HstSelect v-model="state.attributes.INS" title="INS" :options="['6', '8', '10', '12']" />
      <HstSelect v-model="state.attributes.MIG" title="MIG" :options="['6', '8', '10', '12']" />
      <HstSelect v-model="state.attributes.WLP" title="WLP" :options="['6', '8', '10', '12']"
    /></template>
  </Story>
</template>
