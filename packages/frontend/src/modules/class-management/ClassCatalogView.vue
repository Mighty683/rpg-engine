<script setup lang="ts">
import { computed } from "vue";
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { useRoute, useRouter } from "vue-router";
import { useGameQuery } from "../games/hooks";
import ClassCatalogController from "./ClassCatalogController.vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";

const route = useRoute();
const router = useRouter();
const gameId = typeof route.params.gameId === "string" ? route.params.gameId : undefined;
const game = useGameQuery(gameId ?? "");
useQueryErrorToast(game, "Could not open this game. Try again.");
const gameRecord = computed(() => game.data.value?.game);
const classId = computed(() => String(route.params.classId ?? ""));
const screen = computed(() => {
  if (classId.value) return "Details";
  if (route.name === "game-class-copy") return "Copy";
  if (route.name === "library-class-new") return "Create";
  return "List";
});
const gamePath = gameId ? `/games/${gameId}` : undefined;
const catalogPath = gamePath ? `${gamePath}/classes` : "/library/class";
const libraryPath = gameId ? `/library/class?game=${gameId}` : "/library/class";
const returnGame = computed(() =>
  typeof route.query.game === "string" && /^[a-f\d-]{36}$/i.test(route.query.game)
    ? `/games/${route.query.game}/classes`
    : undefined,
);

function navigate(screen: string, id?: string) {
  const segment =
    screen === "Details"
      ? id
      : screen === "Create"
        ? "new"
        : screen === "Copy"
          ? "copy"
          : undefined;
  void router.push({
    path: segment ? `${catalogPath}/${segment}` : catalogPath,
    query: route.query,
  });
}
</script>

<template>
  <ContentState v-if="gameId && game.isLoading.value" kind="loading">Loading game…</ContentState>
  <ContentState v-else-if="gameId && !gameRecord" kind="error" @retry="game.refetch" />
  <ClassCatalogController
    v-else
    :screen="screen"
    :context="gameId ? 'Game' : 'Library'"
    :game-id="gameId"
    :game-name="gameRecord?.name"
    :can-manage="!gameId || gameRecord?.role === 'GM'"
    :context-to="gamePath ? (gameRecord?.role === 'GM' ? libraryPath : undefined) : returnGame"
    :class-id="classId"
    use-breadcrumbs
    :characters-to="gamePath ? `${gamePath}/characters` : undefined"
    @navigate="navigate"
  />
</template>
