<script setup lang="ts">
import ClassManagementController from "./ClassManagementController.vue";

function initialState() {
  return { screen: "List", context: "Library" };
}
</script>

<template>
  <Story title="Prototypes/Class management" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><ClassManagementController
          :screen="state.screen"
          :context="state.context"
          @navigate="state.screen = $event"
      /></UApp>
    </template>
    <template #controls="{ state }">
      <HstSelect v-model="state.context" title="Context" :options="['Library', 'Game']" />
      <HstSelect
        v-model="state.screen"
        title="Screen"
        :options="['List', 'Details', 'Create', 'Copy', 'Removal', 'Character']"
      />
    </template>
  </Story>
</template>
