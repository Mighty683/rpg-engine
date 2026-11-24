<script setup lang="ts">
import ResourceBar from "./ResourceBar.vue";

defineProps<{
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  hpTestId: string;
}>();
</script>
<template>
  <div class="grid gap-card-gap text-card-label tabular-nums">
    <ResourceBar
      v-for="(stat, name) in { hp, mp }"
      :key="name"
      :color="name"
      :label="name.toUpperCase()"
      :value="stat.current"
      :maximum="stat.max"
      class="vital-bar"
    >
      <strong class="me-card-gap">{{ name.toUpperCase() }}</strong>
      <span :data-testid="name === 'hp' ? hpTestId : undefined"
        >{{ stat.current }} / {{ stat.max }}</span
      >
    </ResourceBar>
  </div>
</template>
<style scoped>
.vital-bar.resource-bar {
  height: var(--table-card-bar-height);
}
</style>
