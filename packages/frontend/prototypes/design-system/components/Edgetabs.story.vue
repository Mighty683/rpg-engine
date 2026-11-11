<script setup lang="ts">
import EdgeTabs from "../../../src/shared/design-system/EdgeTabs.vue";
import type { EdgeTab } from "../../../src/shared/design-system/EdgeTabs.vue";

const tabs: EdgeTab[] = [
  { id: "sheets", label: "Character sheets", color: "primary" },
  { id: "history", label: "Throw history", color: "warning" },
  { id: "notes", label: "Notes", color: "neutral" },
];

function initialState() {
  return { overlap: 0.6, opened: null as string | null };
}
</script>

<template>
  <Story title="Design system/Components/Edge tabs" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <EdgeTabs :tabs="tabs" :overlap="state.overlap" @open="(id) => (state.opened = id)">
            <template #sheets>
              <p class="text-muted">Character sheet content slides in here.</p>
            </template>
            <template #history>
              <p class="text-muted">Throw history content slides in here.</p>
            </template>
            <template #notes>
              <p class="text-muted">Notes content slides in here.</p>
            </template>
          </EdgeTabs>
          <p class="max-w-md text-muted">
            Fixed vertical tabs on the right edge. Click a tab to slide its content open; click
            again (or the open tab) to close. Currently open: {{ state.opened ?? "none" }}
          </p>
        </div>
      </UApp>
    </template>
    <template #controls="{ state }">
      <HstSlider v-model="state.overlap" title="Overlap (rem)" :min="0" :max="2" :step="0.1" />
    </template>
  </Story>
</template>
