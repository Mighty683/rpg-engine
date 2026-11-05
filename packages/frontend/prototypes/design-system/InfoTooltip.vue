<script setup lang="ts">
defineProps<{ label: string; text: string }>();
</script>

<template>
  <UTooltip :text="text" :delay-duration="0">
    <button type="button" class="info" :aria-label="label"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor"/><path d="M8 7v4M8 4.5v.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"/></svg></button>
  </UTooltip>
</template>

<style scoped>
.info { display: inline-flex; align-items: center; justify-content: center; color: var(--ui-text-muted); cursor: help; }
.info svg { width: 0.875rem; height: 0.875rem; }
.info:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; border-radius: 50%; }
</style>
