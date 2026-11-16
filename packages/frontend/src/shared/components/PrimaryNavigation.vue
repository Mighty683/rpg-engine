<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const items = computed<NavigationMenuItem[]>(() => [
  {
    label: "Games",
    to: "/",
    exact: true,
    "data-testid": "nav-games",
    "data-section-active": route.path === "/" || typeof route.params.gameId === "string",
  },
  {
    label: "Class library",
    to: "/library/class",
    exact: true,
    "data-testid": "nav-class-library",
    "data-section-active": route.path === "/library/class",
  },
]);
</script>

<template>
  <div>
    <UNavigationMenu
      aria-label="Primary navigation"
      :items="items"
      color="neutral"
      variant="link"
      :ui="{ link: 'min-h-page rounded-none whitespace-nowrap px-small text-small' }"
    />
  </div>
</template>

<style scoped>
:deep([data-section-active="true"]) {
  box-shadow: inset 0 calc(-1 * var(--focus-ring-width)) var(--ui-primary);
  color: var(--ui-text-highlighted);
  font-weight: 600;
}

:deep([data-slot="link"]:focus-visible) {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: calc(-1 * var(--focus-ring-offset));
}
</style>
