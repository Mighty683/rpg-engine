<script setup lang="ts">
import { tr } from "../i18n";
import type { NavigationMenuItem } from "@nuxt/ui";
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const items = computed<NavigationMenuItem[]>(() => [
  {
    label: tr("games.title"),
    to: "/",
    exact: true,
    "data-testid": "nav-games",
    "data-section-active":
      route.path === "/" || route.name === "game-new" || typeof route.params.gameId === "string",
  },
  {
    label: tr("ui.classLibrary"),
    to: "/library/class",
    exact: true,
    "data-testid": "nav-class-library",
    "data-section-active": route.path.startsWith("/library/class"),
  },
]);
</script>

<template>
  <div>
    <UNavigationMenu
      :aria-label="tr('ui.primaryNavigation')"
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
