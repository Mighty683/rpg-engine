<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from "vue-router";

defineProps<{ to: RouteLocationRaw }>();
</script>

<template>
  <RouterLink
    :to="to"
    class="flex cursor-pointer items-center gap-small p-large transition-colors hover:bg-elevated focus-visible:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
  >
    <slot />
    <span aria-hidden="true" class="ml-auto text-muted">→</span>
  </RouterLink>
</template>
