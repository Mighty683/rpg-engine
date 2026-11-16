<script setup lang="ts">
import { computed, ref } from "vue";
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { useRoute } from "vue-router";
import { useGameQuery } from "../games/hooks";
import ClassCatalogController from "./ClassCatalogController.vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";

const route = useRoute();
const gameId = typeof route.params.gameId === "string" ? route.params.gameId : undefined;
const game = useGameQuery(gameId ?? "");
useQueryErrorToast(game, "Could not open this game. Try again.");
const gameRecord = computed(() => game.data.value?.game);
const screen = ref("List");
const gamePath = gameId ? `/games/${gameId}` : undefined;
const libraryPath = gameId ? `/library/class?game=${gameId}` : "/library/class";
const returnGame =
  typeof route.query.game === "string" && /^[a-f\d-]{36}$/i.test(route.query.game)
    ? `/games/${route.query.game}/classes`
    : undefined;
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
    :return-to="gamePath ?? '/'"
    :characters-to="gamePath ? `${gamePath}?manage=characters` : undefined"
    @navigate="screen = $event"
  />
</template>
