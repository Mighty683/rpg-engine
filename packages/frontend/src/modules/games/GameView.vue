<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import ScreenSection from "../../shared/design-system/ScreenSection.vue";
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
const selectedPlayerId = ref<string | undefined>();
const playerTabs = computed(() =>
  playerRecords.value.map((player) => ({ label: player.name, value: player.id, player })),
);
watch(
  playerRecords,
  (records) => {
    if (!records.some((player) => player.id === selectedPlayerId.value))
      selectedPlayerId.value = records[0]?.id;
  },
  { immediate: true },
);
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
    const created = await createPlayer.mutateAsync({ id: pendingPlayerId.value, name: value });
    selectedPlayerId.value = created.player.id;
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
    <p v-if="gameLoading">Loading game…</p>
    <p v-else-if="gameError">
      Could not load game. <UButton color="neutral" variant="outline" @click="game.refetch">Retry</UButton>
    </p>
    <template v-else-if="gameRecord"
      ><h1 class="text-heading font-semibold" data-testid="game-heading">{{ gameRecord.name }}</h1>
      <p class="text-muted">{{ gameRecord.system.name }}</p>
      <ScreenSection aria-labelledby="players-heading" class="space-y-large">
        <h2 id="players-heading" class="text-section font-semibold">Players</h2>
        <form class="flex gap-small" @submit.prevent="addPlayer">
          <UInput
            v-model="name"
            placeholder="Player name"
            aria-label="Player name"
            data-testid="player-name"
          /><UButton type="submit" data-testid="add-player">Add player</UButton>
        </form>
        <p
          v-if="playerCreateError"
          role="alert"
          data-testid="player-create-error"
          class="text-error"
        >
          Could not confirm player creation. Submit again to safely retry.
        </p>
        <p v-if="playersLoading">Loading players…</p>
        <p v-else-if="playersError">
          Could not load players.
          <UButton color="neutral" variant="outline" @click="players.refetch">Retry</UButton>
        </p>
        <p v-else-if="playerRecords.length === 0" class="text-muted">No players yet.</p>
        <UTabs
          v-else
          v-model="selectedPlayerId"
          :items="playerTabs"
          :ui="{ list: 'overflow-x-auto' }"
        >
          <template #default="{ item }"
            ><span data-testid="player-tab">{{ item.label }}</span></template
          >
          <template #content="{ item }">
            <div class="space-y-small p-small">
              <p class="text-muted" data-testid="player-active-character">
                {{
                  item.player.activeCharacter
                    ? `Active character: ${item.player.activeCharacter.name}`
                    : "No active character"
                }}
              </p>
              <RouterLink
                :to="`/games/${gameId}/players/${item.value}`"
                data-testid="player-row-link"
                class="text-primary underline"
                >Manage {{ item.label }}</RouterLink
              >
            </div>
          </template>
        </UTabs>
      </ScreenSection></template
    >
  </div>
</template>
