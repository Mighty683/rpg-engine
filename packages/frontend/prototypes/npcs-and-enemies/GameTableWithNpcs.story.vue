<script setup lang="ts">
import GameTableWithNpcs from "./GameTableWithNpcs.vue";
import type { TableRole, TableScenario } from "./types";
const initialState = () => ({ role: "GM" as TableRole, view: "Mixed" as TableScenario });
</script>
<template>
  <Story title="Prototypes/NPCs and enemies/Game table with NPCs" :init-state="initialState">
    <template #default="{ state }"
      ><GameTableWithNpcs :role="state.role" :view="state.view"
    /></template>
    <template #controls="{ state }">
      <HstSelect v-model="state.role" title="View as" :options="['GM', 'Player']" />
      <HstSelect
        v-model="state.view"
        title="Table contents"
        :options="['Mixed', 'Characters only', 'NPCs only', 'Empty', 'Loading', 'Error']"
      />
    </template>
  </Story>
</template>
