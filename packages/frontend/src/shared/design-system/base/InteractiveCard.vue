<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from "vue-router";

defineProps<{ to: RouteLocationRaw }>();
</script>

<template>
  <RouterLink
    :to="to"
    class="flex cursor-pointer items-center gap-small p-large transition-colors hover:bg-elevated focus-visible:bg-elevated interactive-card"
  >
    <slot />
    <span aria-hidden="true" class="ml-auto text-muted">→</span>
  </RouterLink>
</template>

<style scoped>
.interactive-card:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: calc(-1 * var(--focus-ring-offset));
}
</style>
