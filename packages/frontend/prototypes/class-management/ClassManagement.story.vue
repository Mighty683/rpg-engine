<script setup lang="ts">
import ClassManagementPrototype from "./ClassManagementPrototype.vue";

function initialState() {
  return { screen: "List", context: "Library" };
}
</script>

<template>
  <Story title="Prototypes/Class management" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><ClassManagementPrototype
          :screen="state.screen"
          :context="state.context"
          @navigate="state.screen = $event"
          @switch-context="
            state.context = $event;
            state.screen = 'List';
          "
      /></UApp>
    </template>
    <template #controls="{ state }">
      <HstSelect
        :model-value="state.context"
        title="Context"
        :options="['Library', 'Game']"
        @update:model-value="
          state.context = $event;
          state.screen = 'List';
        "
      />
      <HstSelect
        v-model="state.screen"
        title="Screen"
        :options="
          state.context === 'Library'
            ? ['List', 'Details', 'Create']
            : ['List', 'Details', 'Copy', 'Character']
        "
      />
    </template>
  </Story>
</template>
