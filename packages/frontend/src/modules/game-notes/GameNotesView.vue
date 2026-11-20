<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import { account } from "../auth/session";
import { useGameQuery } from "../games/hooks";
import NotesController from "./NotesController.vue";

/**
 * Route view for the game-notes screens. A direct visit waits for the game
 * query first: players (and unknown games) get an unavailable screen with a
 * route back and no notes request is ever made.
 */
const route = useRoute();
const gameId = String(route.params.gameId ?? "");
const game = useGameQuery(gameId);
const gameRecord = computed(() => game.data.value?.game);
const canUseNotes = computed(() => Boolean(account.value && gameRecord.value?.role === "GM"));
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-section">
    <ContentState v-if="game.isLoading.value" kind="loading">Loading game…</ContentState>
    <ContentState v-else-if="game.isError.value" kind="error" @retry="game.refetch" />
    <div v-else-if="!canUseNotes" class="space-y-medium" data-testid="notes-unavailable">
      <h1 class="text-heading font-semibold">Game notes</h1>
      <p class="text-muted">Game notes are only available to the GM of this game.</p>
      <UButton
        :to="gameRecord ? `/games/${gameId}` : '/'"
        color="neutral"
        variant="outline"
        data-testid="notes-unavailable-back"
        >{{ gameRecord ? gameRecord.name : "My games" }}</UButton
      >
    </div>
    <NotesController v-else :game-id="gameId" :game-name="gameRecord!.name" />
  </div>
</template>
