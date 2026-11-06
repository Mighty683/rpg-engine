<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useGameQuery } from "./hooks";
import { usePlayersQuery, useCreatePlayerMutation } from "../players/hooks";
const route = useRoute();
const gameId = String(route.params.gameId);
const name = ref("");
const pendingPlayerId = ref<string | null>(null);
const pendingPlayerName = ref("");
const playerCreateError = ref(false);
const game = useGameQuery(gameId);
const players = usePlayersQuery(gameId);
const createPlayer = useCreatePlayerMutation(gameId);
const gameRecord = computed(() => game.data.value?.game);
const playerRecords = computed(() => players.data.value?.players ?? []);
const gameLoading = computed(() => game.isLoading.value);
const gameError = computed(() => game.isError.value);
const playersLoading = computed(() => players.isLoading.value);
const playersError = computed(() => players.isError.value);
async function addPlayer() {
  const value = name.value.trim();
  if (!value) return;
  playerCreateError.value = false;
  if (pendingPlayerName.value && pendingPlayerName.value !== value) pendingPlayerId.value = null;
  pendingPlayerName.value = value;
  pendingPlayerId.value ??= crypto.randomUUID();
  try {
    await createPlayer.mutateAsync({ id: pendingPlayerId.value, name: value });
    pendingPlayerId.value = null;
    pendingPlayerName.value = "";
    name.value = "";
    await players.refetch();
  } catch {
    playerCreateError.value = true;
  }
}
</script>
<template>
  <div data-testid="game-view" class="max-w-3xl space-y-section">
    <RouterLink to="/" class="text-muted">← Games</RouterLink>
    <p v-if="gameLoading">Loading game…</p>
    <p v-else-if="gameError">
      Could not load game. <UButton variant="outline" @click="game.refetch">Retry</UButton>
    </p>
    <template v-else-if="gameRecord"
      ><h1 class="text-heading font-semibold" data-testid="game-heading">{{ gameRecord.name }}</h1>
      <p class="text-muted">{{ gameRecord.system.name }}</p>
      <form class="flex gap-small" @submit.prevent="addPlayer">
        <UInput
          v-model="name"
          placeholder="Player name"
          aria-label="Player name"
          data-testid="player-name"
        /><UButton type="submit" data-testid="add-player">Add player</UButton>
      </form>
      <p v-if="playerCreateError" role="alert" data-testid="player-create-error" class="text-error">
        Could not confirm player creation. Submit again to safely retry.
      </p>
      <p v-if="playersLoading">Loading players…</p>
      <p v-else-if="playersError">
        Could not load players. <UButton variant="outline" @click="players.refetch">Retry</UButton>
      </p>
      <ul v-else class="divide-y divide-default rounded-panel border border-default">
        <li v-for="player in playerRecords" :key="player.id" class="p-large">
          <RouterLink
            :to="`/games/${gameId}/players/${player.id}`"
            class="flex justify-between"
            data-testid="player-row-link"
            ><span>{{ player.name }}</span
            ><span v-if="player.activeCharacter" class="text-muted">{{
              player.activeCharacter.name
            }}</span></RouterLink
          >
        </li>
      </ul></template
    >
  </div>
</template>
