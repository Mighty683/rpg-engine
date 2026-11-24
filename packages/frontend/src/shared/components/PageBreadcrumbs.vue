<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useGameQuery } from "../../modules/games/hooks";

const route = useRoute();
const gameId = typeof route.params.gameId === "string" ? route.params.gameId : "";
const game = useGameQuery(gameId);
const items = computed(() =>
  route.matched.flatMap(({ meta }) => {
    const crumb = meta.breadcrumb;
    if (!crumb) return [];
    const label =
      crumb.route === "game-table" ? (game.data.value?.game.name ?? crumb.label) : crumb.label;
    return [
      {
        label,
        to: crumb.route
          ? {
              name: crumb.route,
              query:
                crumb.route === "class-library" && route.query.game
                  ? { game: route.query.game }
                  : undefined,
            }
          : undefined,
        testId: crumb.route ? `breadcrumb-${crumb.route}` : undefined,
      },
    ];
  }),
);
</script>

<template>
  <nav v-if="items.length" aria-label="Breadcrumb" class="mx-auto mb-small max-w-6xl">
    <ol class="flex flex-wrap items-center gap-small text-small text-muted">
      <li v-for="(item, index) in items" :key="index" class="flex items-center gap-small">
        <UIcon v-if="index > 0" name="i-lucide-chevron-right" aria-hidden="true" />
        <ULink
          v-if="item.to && index < items.length - 1"
          :to="item.to"
          :data-testid="item.testId"
          class="underline-offset-4 hover:text-highlighted hover:underline"
          >{{ item.label }}</ULink
        >
        <span v-else aria-current="page" class="font-medium text-default">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>
