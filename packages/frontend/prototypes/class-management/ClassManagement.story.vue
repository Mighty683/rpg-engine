<script setup lang="ts">
import ClassManagementPreview from "../../src/modules/class-management/ClassManagementPreview.vue";

function initialState() {
  return { screen: "List", context: "Library" };
}
</script>

<template>
  <Story title="Prototypes/Class management" :init-state="initialState">
    <template #default="{ state }">
      <UApp><ClassManagementPreview :screen="state.screen" :context="state.context" /></UApp>
    </template>
    <template #controls="{ state }">
      <HstSelect v-model="state.context" title="Context" :options="['Library', 'Game']" />
      <HstSelect
        v-model="state.screen"
        title="Screen"
        :options="['List', 'Editor', 'Copy', 'Removal', 'Character']"
      />
    </template>
  </Story>
</template>
