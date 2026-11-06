<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, RouterLink, useRouter } from "vue-router";
import { usePlayerQuery } from "./hooks";
import {
  useCharactersQuery,
  useCreateCharacterMutation,
  useActiveCharacterMutation,
} from "../characters/hooks";
const route = useRoute();
const router = useRouter();
const gameId = String(route.params.gameId);
const playerId = String(route.params.playerId);
const name = ref("");
const pendingCharacterId = ref<string | null>(null);
const pendingCharacterName = ref("");
const characterCreateError = ref(false);
const player = usePlayerQuery(gameId, playerId);
const characters = useCharactersQuery(gameId, playerId);
const createCharacterMutation = useCreateCharacterMutation(gameId, playerId);
const activeMutation = useActiveCharacterMutation(gameId, playerId);
const playerRecord = computed(() => player.data.value?.player);
const characterRecords = computed(() => characters.data.value?.characters ?? []);
const playerLoading = computed(() => player.isLoading.value);
const playerError = computed(() => player.isError.value);
const charactersLoading = computed(() => characters.isLoading.value);
const charactersError = computed(() => characters.isError.value);
async function createCharacter() {
  const value = name.value.trim();
  if (!value) return;
  characterCreateError.value = false;
  if (pendingCharacterName.value && pendingCharacterName.value !== value)
    pendingCharacterId.value = null;
  pendingCharacterName.value = value;
  pendingCharacterId.value ??= crypto.randomUUID();
  try {
    const created = await createCharacterMutation.mutateAsync({
      id: pendingCharacterId.value,
      name: value,
    });
    pendingCharacterId.value = null;
    pendingCharacterName.value = "";
    name.value = "";
    await characters.refetch();
    await router.push(`/games/${gameId}/players/${playerId}/characters/${created.character.id}`);
  } catch {
    characterCreateError.value = true;
  }
}
async function setActive(id: string | null) {
  if (!player.data.value) return;
  await activeMutation.mutateAsync({
    expectedRevision: player.data.value.player.revision,
    characterId: id,
  });
  await player.refetch();
}
</script>
<template>
  <div data-testid="player-view" class="max-w-3xl space-y-section">
    <RouterLink :to="`/games/${gameId}`" class="text-muted" data-testid="game-link"
      >← Game</RouterLink
    >
    <p v-if="playerLoading">Loading player…</p>
    <p v-else-if="playerError">
      Could not load player. <UButton variant="outline" @click="player.refetch">Retry</UButton>
    </p>
    <template v-else-if="playerRecord"
      ><h1 class="text-heading font-semibold">{{ playerRecord.name }}</h1>
      <form class="flex gap-small" @submit.prevent="createCharacter">
        <UInput
          v-model="name"
          placeholder="Character name"
          aria-label="Character name"
          data-testid="character-name-input"
        /><UButton type="submit" data-testid="create-character">Create character</UButton>
      </form>
      <p v-if="characterCreateError" role="alert" class="text-error">
        Could not confirm character creation. Submit again to safely retry.
      </p>
      <p v-if="charactersLoading">Loading characters…</p>
      <p v-else-if="charactersError">
        Could not load characters.
        <UButton variant="outline" @click="characters.refetch">Retry</UButton>
      </p>
      <ul v-else class="grid gap-medium sm:grid-cols-2">
        <li
          v-for="character in characterRecords"
          :key="character.id"
          class="rounded-panel border border-default p-large"
        >
          <RouterLink
            :to="`/games/${gameId}/players/${playerId}/characters/${character.id}`"
            class="font-medium"
            data-testid="character-link"
            >{{ character.name }}</RouterLink
          >
          <p class="text-muted">Level {{ character.level }}</p>
          <UButton
            size="sm"
            variant="outline"
            :data-testid="
              playerRecord.activeCharacter?.id === character.id ? 'active-character' : 'set-active'
            "
            @click="setActive(character.id)"
            >{{
              playerRecord.activeCharacter?.id === character.id ? "Active" : "Set active"
            }}</UButton
          >
        </li>
      </ul>
      <UButton
        v-if="playerRecord.activeCharacter"
        variant="outline"
        data-testid="clear-active"
        @click="setActive(null)"
        >Clear active character</UButton
      ></template
    >
  </div>
</template>
