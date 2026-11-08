<script setup lang="ts">
import ConfirmDialog from "../../shared/design-system/ConfirmDialog.vue";
import ContentState from "../../shared/design-system/ContentState.vue";
import { useToast } from "@nuxt/ui/composables";
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import { account } from "../auth/session";
import CharacterView from "../characters/CharacterView.vue";
import {
  useAssignGameCharacterMutation,
  useCreateGameCharacterMutation,
  useDeleteGameCharacterMutation,
  useGameCharacterActiveMutation,
  useGameCharactersQuery,
} from "../characters/hooks";
import CharacterManagement from "./CharacterManagement.vue";
import GameSettings from "./GameSettings.vue";
import GameTable from "../game-table/GameTable.vue";
import { partyKey, throwsKey } from "../game-table/hooks";
import { useGameMembersQuery, useGameQuery, useSelectGameCharacterMutation } from "./hooks";
import { newUuid } from "../../shared/uuid";

const toast = useToast();
const route = useRoute();
const gameId = String(route.params.gameId);
const game = useGameQuery(gameId);
const queryClient = useQueryClient();
const membersQuery = useGameMembersQuery(gameId);
const roster = useGameCharactersQuery(gameId);
useQueryErrorToast(game, "Could not open this game. Return to your games and try again.");
useQueryErrorToast(roster, "Could not load characters. Try again.");
useQueryErrorToast(membersQuery, "Could not load membership details. Try again.");
const createCharacter = useCreateGameCharacterMutation(gameId);
const setActive = useGameCharacterActiveMutation(gameId);
const selectCharacter = useSelectGameCharacterMutation(gameId);
const assignCharacter = useAssignGameCharacterMutation(gameId);
const deleteCharacter = useDeleteGameCharacterMutation(gameId);
const gameRecord = computed(() => game.data.value?.game);
const characters = computed(() => roster.data.value?.characters ?? []);
const members = computed(() => membersQuery.data.value?.members ?? []);
const currentMember = computed(() => members.value.find((member) => member.accountId === account.value?.id && !member.removed));
const activeTabs = computed(() => [...characters.value].filter((character) => character.active).sort((a, b) => Number(b.canEdit) - Number(a.canEdit)).map((character) => ({
  label: character.name,
  value: character.id,
})));
const selectedId = ref("");
const initialCharacterId = typeof route.query.character === "string" ? route.query.character : "";
const management = ref(Boolean(initialCharacterId));
const settings = ref(false);
const managedCharacterId = ref(initialCharacterId);
const createOpen = ref(false);
const characterName = ref("");
const createError = ref("");
const removingId = ref("");
const removingCharacter = computed(() => characters.value.find((character) => character.id === removingId.value));
const managedCharacter = computed(() => characters.value.find((character) => character.id === managedCharacterId.value));
const pendingId = ref<string | null>(null);
const pendingName = ref("");
const heading = ref<HTMLElement>();
const throwsHint = ref(0);
let events: EventSource | undefined;
let eventConnectionFailed = false;

function refreshGameQueries(characterId?: string) {
  const prefix = ["accounts", account.value?.id, "games", gameId];
  void queryClient.invalidateQueries({ queryKey: [...prefix, "characters"], exact: !characterId });
  if (characterId) void queryClient.invalidateQueries({ queryKey: [...prefix, "characters", characterId] });
  void queryClient.invalidateQueries({ queryKey: [...prefix, "members"] });
  void queryClient.invalidateQueries({ queryKey: partyKey(gameId) });
  throwsHint.value += 1;
}
onMounted(() => {
  events = new EventSource(`/api/games/${gameId}/events`);
  events.onopen = () => {
    eventConnectionFailed = false;
    refreshGameQueries(managedCharacterId.value || selectedId.value || undefined);
  };
  events.onmessage = (event) => {
    try {
      const hint = JSON.parse(event.data) as { type?: string; characterId?: string };
      if (hint.type === "roster") refreshGameQueries();
      if (hint.type === "sheet" && hint.characterId) refreshGameQueries(hint.characterId);
      if (hint.type === "throws") {
        throwsHint.value += 1;
        void queryClient.invalidateQueries({ queryKey: throwsKey(gameId) });
      }
    } catch {
      // Ignore malformed invalidation hints; HTTP responses remain authoritative.
    }
  };
  events.onerror = () => {
    if (!eventConnectionFailed) {
      toast.add({ title: "Live updates disconnected. Reconnecting automatically.", color: "error" });
      eventConnectionFailed = true;
    }
    void game.refetch();
    void roster.refetch();
    refreshGameQueries();
  };
});
onUnmounted(() => events?.close());

watch(activeTabs, (tabs) => {
  if (!tabs.some((tab) => tab.value === selectedId.value)) selectedId.value = tabs[0]?.value ?? "";
}, { immediate: true });

async function focusHeading() {
  await nextTick();
  heading.value?.focus();
}
function openManagement() {
  management.value = true;
  managedCharacterId.value = "";
  void focusHeading();
}
function returnToGame() {
  management.value = false;
  settings.value = false;
  managedCharacterId.value = "";
  void focusHeading();
}
function openSettings() {
  settings.value = true;
  void focusHeading();
}
function refreshSettings() {
  void membersQuery.refetch();
  void roster.refetch();
}
function openSheet(characterId: string) {
  managedCharacterId.value = characterId;
  void focusHeading();
}
function openCreate() {
  characterName.value = "";
  createError.value = "";
  pendingId.value = null;
  pendingName.value = "";
  createOpen.value = true;
}
async function submitCharacter() {
  const name = characterName.value.trim();
  if (!name) {
    createError.value = "Enter a character name.";
    return;
  }
  if (pendingName.value !== name) pendingId.value = null;
  pendingName.value = name;
  pendingId.value ??= newUuid();
  createError.value = "";
  try {
    const result = await createCharacter.mutateAsync({ id: pendingId.value, name });
    createOpen.value = false;
    pendingId.value = null;
    const refreshed = await roster.refetch();
    const created = refreshed.data?.characters.find((character) => character.id === result.character.id);
    management.value = !created?.active;
    managedCharacterId.value = created?.active ? "" : result.character.id;
    if (created?.active) selectedId.value = result.character.id;
    void focusHeading();
  } catch {
    toast.add({ title: "Could not confirm character creation. Submit again to safely retry.", color: "error" });
  }
}
async function changeActive(characterId: string, active: boolean) {
  try {
    const character = characters.value.find((entry) => entry.id === characterId);
    if (!character) throw new Error("Character unavailable");
    if (gameRecord.value?.role === "GM" && !character.controllerMembershipId) {
      await setActive.mutateAsync({ characterId, active });
    } else {
      const member = gameRecord.value?.role === "GM"
        ? members.value.find((entry) => entry.id === character.controllerMembershipId && !entry.removed)
        : currentMember.value;
      if (!member) throw new Error("Membership unavailable");
      await selectCharacter.mutateAsync({ characterId: active ? characterId : null, expectedRevision: member.revision, ...(gameRecord.value?.role === "GM" ? { membershipId: member.id } : {}) });
    }
  } catch {
    toast.add({ title: "Could not update the active character. Try again.", color: "error" });
  }
}
async function assign(characterId: string, membershipId: string | null) {
  try {
    await assignCharacter.mutateAsync({ characterId, membershipId });
    await membersQuery.refetch();
  } catch {
    toast.add({ title: "Could not update character control. Try again.", color: "error" });
  }
}
async function removeCharacter() {
  if (!removingId.value) return;
  try {
    await deleteCharacter.mutateAsync(removingId.value);
    removingId.value = "";
    await membersQuery.refetch();
  } catch {
    toast.add({ title: "Could not remove the character. Try again.", color: "error" });
  }
}
</script>

<template>
  <div data-testid="game-view" class="mx-auto max-w-6xl space-y-section">
    <ContentState v-if="game.isLoading.value" kind="loading">Loading game…</ContentState>
    <p v-else-if="game.isError.value"><UButton to="/" variant="outline" color="neutral">My games</UButton></p>
    <template v-else-if="gameRecord">
      <header class="flex flex-wrap items-start justify-between gap-medium">
        <div>
          <h1 ref="heading" tabindex="-1" class="text-heading font-semibold" data-testid="game-heading">
            {{ settings ? "Settings" : management ? (managedCharacterId ? "Character sheet" : "Characters management") : gameRecord.name }}
          </h1>
          <p class="text-muted">{{ gameRecord.name }} · {{ gameRecord.system.name }} · {{ gameRecord.role }}</p>
        </div>
        <div class="flex gap-small">
          <UButton v-if="management && managedCharacterId" color="neutral" variant="outline" @click="managedCharacterId = ''; focusHeading()">Back to characters</UButton>
          <UButton v-if="management || settings" color="neutral" variant="outline" data-testid="return-to-game" @click="returnToGame">Return to game</UButton>
          <UButton v-else-if="gameRecord.role === 'GM'" color="neutral" variant="outline" data-testid="open-settings" @click="openSettings">Settings</UButton>
        </div>
      </header>
      <ContentState v-if="roster.isLoading.value" kind="loading">Loading characters…</ContentState>
      <ContentState v-else-if="roster.isError.value" kind="error" @retry="roster.refetch" />
      <template v-else>
        <GameSettings v-if="settings" :game-id="gameId" :members="members" :characters="characters" @changed="refreshSettings" />
        <template v-else-if="management && managedCharacterId">
          <CharacterView :key="managedCharacterId" :game-id="gameId" :character-id="managedCharacterId" :read-only="gameRecord.role !== 'GM' && !managedCharacter?.canEdit" />
        </template>
        <template v-else-if="management">
          <p v-if="membersQuery.isError.value" role="alert"><UButton variant="outline" color="neutral" @click="membersQuery.refetch">Retry</UButton></p>
          <CharacterManagement v-else :characters="characters" :members="members" :role="gameRecord.role" :pending="setActive.isPending.value || selectCharacter.isPending.value || assignCharacter.isPending.value || deleteCharacter.isPending.value" @open="openSheet" @set-active="changeActive" @assign="assign" @remove="removingId = $event" />
        </template>
        <template v-else>
          <div class="flex flex-wrap justify-end gap-small">
            <UButton data-testid="create-character" @click="openCreate">Create character</UButton>
            <UButton data-testid="manage-characters" color="neutral" variant="outline" @click="openManagement">Characters management</UButton>
          </div>
          <GameTable :game-id="gameId" :role="gameRecord.role" :throws-hint="throwsHint" />
        </template>
      </template>
    </template>
    <UModal v-model:open="createOpen" title="Create a character">
      <template #body>
        <form class="space-y-medium" @submit.prevent="submitCharacter">
          <UFormField label="Character name" :error="createError"><UInput v-model="characterName" data-testid="character-name" class="w-full" /></UFormField>
          <div class="flex flex-wrap justify-end gap-small"><UButton type="button" variant="outline" color="neutral" @click="createOpen = false">Cancel</UButton><UButton type="submit" :loading="createCharacter.isPending.value">Create character</UButton></div>
        </form>
      </template>
    </UModal>
    <ConfirmDialog :open="Boolean(removingId)" title="Remove character" confirm-label="Remove permanently" confirm-test-id="confirm-character-removal" destructive :pending="deleteCharacter.isPending.value" @cancel="removingId = ''" @confirm="removeCharacter">
      <p>Remove {{ removingCharacter?.name }}? This permanently removes the character and its sheet.</p>
    </ConfirmDialog>
  </div>
</template>
