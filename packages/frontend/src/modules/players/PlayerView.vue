<script setup lang="ts">
import ContentState from "../../shared/design-system/ContentState.vue";
import { useToast } from "@nuxt/ui/composables";
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { computed, ref } from "vue";
import { useRoute, RouterLink, useRouter } from "vue-router";
import { usePlayerQuery } from "./hooks";
import InteractiveCard from "../../shared/design-system/InteractiveCard.vue";
import {
  useCharactersQuery,
  useCreateCharacterMutation,
  useActiveCharacterMutation,
} from "../characters/hooks";
const toast = useToast();
const route = useRoute();
const router = useRouter();
const gameId = String(route.params.gameId);
const playerId = String(route.params.playerId);
const name = ref("");
const pendingCharacterId = ref<string | null>(null);
const pendingCharacterName = ref("");
const creatingCharacter = ref(false);
const updatingActiveCharacter = ref(false);
const player = usePlayerQuery(gameId, playerId);
const characters = useCharactersQuery(gameId, playerId);
useQueryErrorToast(player, "Could not load player. Try again.");
useQueryErrorToast(characters, "Could not load characters. Try again.");
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
  if (!value || creatingCharacter.value) return;
  creatingCharacter.value = true;
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
    toast.add({ title: "Could not confirm character creation. Submit again to safely retry.", color: "error" });
  } finally {
    creatingCharacter.value = false;
  }
}
async function setActive(id: string) {
  if (!player.data.value || updatingActiveCharacter.value) return;
  updatingActiveCharacter.value = true;
  try {
    await activeMutation.mutateAsync({
      expectedRevision: player.data.value.player.revision,
      characterId: player.data.value.player.activeCharacter?.id === id ? null : id,
    });
    await player.refetch();
  } catch {
    toast.add({ title: "Could not update the active character. Try again.", color: "error" });
    await player.refetch();
  } finally {
    updatingActiveCharacter.value = false;
  }
}
</script>
<template>
  <div data-testid="player-view" class="max-w-3xl space-y-section">
    <RouterLink :to="`/games/${gameId}`" class="text-muted" data-testid="game-link"
      >← Game</RouterLink
    >
    <ContentState v-if="playerLoading" kind="loading">Loading player…</ContentState>
    <ContentState v-else-if="playerError" kind="error" @retry="player.refetch" />
    <template v-else-if="playerRecord"
      ><h1 class="text-heading font-semibold">{{ playerRecord.name }}</h1>
      <ContentState v-if="charactersLoading" kind="loading">Loading characters…</ContentState>
      <ContentState v-else-if="charactersError" kind="error" @retry="characters.refetch" />
      <ul class="grid gap-medium sm:grid-cols-2">
        <li
          v-for="character in characterRecords"
          :key="character.id"
          class="relative min-h-28 rounded-panel border border-default"
        >
          <InteractiveCard
            :to="`/games/${gameId}/players/${playerId}/characters/${character.id}`"
            class="items-start rounded-panel pb-16 after:absolute after:inset-0"
            data-testid="character-link"
          >
            <span class="min-w-0">
              <span class="block font-medium">{{ character.name }}</span>
              <span class="block text-muted">Level {{ character.level }}</span>
            </span>
          </InteractiveCard>
          <UButton
            size="sm"
            color="neutral" variant="outline"
            class="absolute bottom-4 left-4 z-10"
            :data-testid="
              playerRecord.activeCharacter?.id === character.id ? 'active-character' : 'set-active'
            "
            :aria-pressed="playerRecord.activeCharacter?.id === character.id"
            :aria-label="`${playerRecord.activeCharacter?.id === character.id ? 'Deactivate' : 'Set active'} ${character.name}`"
            :disabled="updatingActiveCharacter"
            @click="setActive(character.id)"
            >{{
              playerRecord.activeCharacter?.id === character.id ? "Active" : "Set active"
            }}</UButton
          >
        </li>
        <li class="rounded-panel border border-default p-large">
          <form class="flex h-full flex-col gap-small" @submit.prevent="createCharacter">
            <UInput
              v-model="name"
              class="w-full min-w-0"
              placeholder="Character name"
              aria-label="Character name"
              data-testid="character-name-input"
            />
            <UButton
              type="submit"
              class="mt-auto self-end"
              data-testid="create-character"
              :disabled="creatingCharacter"
              >+ Add character</UButton
            >
          </form>
        </li>
      </ul>
    </template>
  </div>
</template>
