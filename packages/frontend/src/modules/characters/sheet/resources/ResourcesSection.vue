<script setup lang="ts">
import SheetSection from "../SheetSection.vue";
import ResourceField from "./ResourceField.vue";
import type { Character } from "../types";
type Resource = "HP" | "MP" | "IP";
defineProps<{
  current: Character["current"];
  maximum: Record<Resource, number>;
  maximumOverrides: Record<Resource, number | null>;
}>();
const emit = defineEmits<{ override: [resource: Resource, value: number | null] }>();
</script>

<template>
  <SheetSection
    ><template #heading>✚ RESOURCES</template><template #hint>CURRENT / MAX</template>
    <div class="grid">
      <ResourceField
        v-for="resource in ['HP', 'MP', 'IP'] as const"
        :key="resource"
        v-model="current[resource]"
        :label="resource"
        :maximum="maximum[resource]"
        :maximum-override="maximumOverrides[resource]"
        @override="emit('override', resource, $event)"
      /><ResourceField v-model="current.Fabula" label="FABULA" /></div
  ></SheetSection>
</template>

<style scoped>
.grid {
  display: grid;
  gap: var(--spacing-small);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: var(--sheet-tight);
}
@media (max-width: 420px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
