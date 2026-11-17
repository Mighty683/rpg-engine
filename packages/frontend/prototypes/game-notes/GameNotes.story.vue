<script setup lang="ts">
import NotesPreview from "./NotesPreview.vue";
import { notesApi } from "./api";
import type { PrototypeScenario } from "../api";
const initialState = (): { scenario: PrototypeScenario } => ({ scenario: "default" });
</script>

<template>
  <Story title="Prototypes/Game notes" :init-state="initialState">
    <template #default="{ state }">
      <UApp><NotesPreview :key="state.scenario" :api="notesApi" :scenario="state.scenario" /></UApp>
    </template>
    <template #controls="{ state }">
      <HstSelect
        v-model="state.scenario"
        title="Backend scenario"
        :options="['default', 'empty', 'loading', 'error']"
      />
    </template>
  </Story>
</template>
