<script setup lang="ts">
defineProps<{ kind: "other" | "armor" | "equipped" }>();
</script>

<template>
  <svg viewBox="0 0 24 24" class="equipment-icon" aria-hidden="true" focusable="false">
    <path v-if="kind === 'armor'" d="M8 3 5 5 2.5 9 5 11l1.5-1V21h11V10l1.5 1 2.5-2L19 5l-3-2c-.5 2-1.8 3-4 3S8.5 5 8 3Z" />
    <path v-else-if="kind === 'other'" d="M4 7h16v13H4zM8 7V5h8v2M4 12h16M10 12v2h4v-2" />
    <template v-else><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></template>
  </svg>
</template>

<style scoped>
.equipment-icon { width: 1rem; height: 1rem; flex: none; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
</style>
