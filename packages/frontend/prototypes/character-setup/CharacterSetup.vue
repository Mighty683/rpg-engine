<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useToast } from "@nuxt/ui/composables";
import CharacterSheet from "./CharacterSheet.vue";
import PrototypeNavigation from "./PrototypeNavigation.vue";
import GamesScreen from "./GamesScreen.vue";
import CreateGameScreen from "./CreateGameScreen.vue";
import GameScreen from "./GameScreen.vue";
import PlayerScreen from "./PlayerScreen.vue";
import { createMockApi } from "./mock-api";
import type { Character, Game, Player } from "./types";

const toast = useToast();
type Screen = "games" | "create" | "game" | "player" | "setup";
const screen = ref<Screen>("setup");
const screenView = ref<{ focus: () => void }>();
const characterSheet = ref<InstanceType<typeof CharacterSheet>>();
const mockApi = createMockApi();
const games = ref(mockApi.games);
const game = ref<Game>(games.value[0]!);
const gameName = ref("");
const system = ref("");
const playerName = ref("");
const player = ref<Player>(game.value.players[0]!);
const character = ref<Character>(player.value.characters[0]!);
const listState = ref("ready");
const formError = ref("");
const hasPlayer = computed(() => game.value.players.some((entry) => entry.id === player.value?.id));
const navOpen = ref(false);
const hasCharacter = computed(() => hasPlayer.value && player.value.characters.some((entry) => entry.id === character.value?.id));
const navigationItems = computed(() => [
  { label: "Games", active: screen.value === "games" || screen.value === "create", onSelect: () => navigate("games") },
  { label: game.value.name, active: screen.value === "game", onSelect: () => navigate("game") },
  ...(hasPlayer.value ? [{ label: player.value.name, active: screen.value === "player", onSelect: () => navigate("player") }] : []),
  ...(hasCharacter.value ? [{ label: character.value.identity.name || "Character", active: screen.value === "setup", onSelect: () => navigate("setup") }] : []),
]);
function navigate(target: Screen) { navOpen.value = false; void show(target); }
async function show(next: Screen) { screen.value = next; formError.value = ""; await nextTick(); if (next === "setup") characterSheet.value?.focus(); else screenView.value?.focus(); }
function createGame() {
  if (!gameName.value.trim() || !system.value) { formError.value = "Enter a game name and choose a system."; return; }
  const created = mockApi.createGame(gameName.value.trim(), system.value);
  games.value.unshift(created); game.value = games.value[0]!; gameName.value = ""; system.value = ""; toast.add({ title: "Game created", color: "success" }); void show("game");
}
function openGame(selected: Game) { game.value = selected; void show("game"); }
function addPlayer() {
  if (!playerName.value.trim()) { formError.value = "Enter a player name."; return; }
  game.value.players.push(mockApi.createPlayer(playerName.value.trim())); player.value = game.value.players.at(-1)!; playerName.value = ""; toast.add({ title: "Player added", color: "success" }); void show("player");
}
function openPlayer(selected: Player) { player.value = selected; void show("player"); }
function createCharacter() { player.value.characters.push(mockApi.createCharacter()); character.value = player.value.characters.at(-1)!; void show("setup"); }
function openCharacter(selected: Character) { character.value = selected; void show("setup"); }
</script>

<template>
  <UContainer class="py-small">
    <div class="mx-auto max-w-6xl space-y-small">
      <div v-if="screen !== 'setup'" class="flex flex-wrap items-center justify-between gap-medium border-b border-default pb-large">
        <div><p class="text-muted">Character setup</p><p class="font-semibold">A place for every adventurer</p></div>
        <div class="flex flex-wrap items-center gap-medium text-muted"><label for="list-state">List state</label><select id="list-state" v-model="listState" class="rounded-panel border border-default bg-default p-small"><option value="ready">Ready</option><option value="loading">Loading</option><option value="error">Error</option><option value="empty">Empty</option></select></div>
      </div>

      <div class="prototype-layout">
        <PrototypeNavigation v-model="navOpen" :items="navigationItems" />
        <div class="prototype-content space-y-medium">
      <GamesScreen v-if="screen === 'games'" ref="screenView" :games="games" v-model:list-state="listState" @create="show('create')" @open="openGame" />
      <CreateGameScreen v-else-if="screen === 'create'" ref="screenView" v-model:game-name="gameName" v-model:system="system" :form-error="formError" @create="createGame" @cancel="show('games')" />
      <GameScreen v-else-if="screen === 'game'" ref="screenView" :game="game" v-model:player-name="playerName" :form-error="formError" @add-player="addPlayer" @open-player="openPlayer" />
      <PlayerScreen v-else-if="screen === 'player'" ref="screenView" :game="game" :player="player" @create-character="createCharacter" @open-character="openCharacter" @set-active="player.activeCharacterId = $event.id" />
      <CharacterSheet v-else ref="characterSheet" :character="character" />
        </div>
      </div>
    </div>
  </UContainer>
</template>

<style scoped>
.prototype-layout { display: flex; flex-direction: column; gap: var(--spacing-medium); }
.prototype-content { min-width: 0; flex: 1; }
@media (min-width: 1024px) { .prototype-layout { flex-direction: row; align-items: stretch; } }
</style>
