<script setup lang="ts">
import type { Resource } from "../types";

import SheetSection from "../../../../shared/design-system/SheetSection.vue";
import ResourceField from "./ResourceField.vue";
import type { Character } from "../types";

defineProps<{
  current: Character["current"];
  maximum: Record<Resource, number>;
  maximumOverrides: Record<Resource, number | null>;
}>();
const emit = defineEmits<{ override: [resource: Resource, value: number | null] }>();
</script>

<template>
  <SheetSection
    ><template #heading>✚ RESOURCES</template>
    <div class="resource-card">
      <ResourceField
        v-for="resource in ['IP'] as const"
        :key="resource"
        v-model="current[resource]"
        :label="resource"
        :maximum="maximum[resource]"
        :maximum-override="maximumOverrides[resource]"
        help="Inventory Points"
        compact
        @override="emit('override', resource, $event)"
      /><ResourceField v-model="current.Fabula" label="FP" help="Fabula Points" compact /></div
  ></SheetSection>
</template>

<style scoped>
.resource-card {
  display: grid;
  gap: var(--spacing-small);
  margin-top: var(--sheet-tight);
  padding: var(--spacing-small);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
}
</style>
