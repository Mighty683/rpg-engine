<script setup lang="ts">
import ProgressionPrototype from "./ProgressionPrototype.vue";
function initialState() {
  return { readOnly: false };
}
</script>
<template>
  <Story title="Prototypes/Class progression" :init-state="initialState">
    <template #default="{ state }"
      ><UApp><ProgressionPrototype :read-only="state.readOnly" /></UApp
    ></template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.readOnly" title="Read-only"
    /></template>
  </Story>
</template>
