<script setup lang="ts">
import { tr } from "../../shared/i18n";
import GameBodySkeleton from "./GameBodySkeleton.vue";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import CreateFormDialog from "../../shared/design-system/base/CreateFormDialog.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import { useApiServices } from "../../shared/api-services";
import ConfirmDialog from "../../shared/design-system/base/ConfirmDialog.vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import { useToast } from "@nuxt/ui/composables";
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
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
import AgentTable from "../agent/AgentTable.vue";
import GameTable from "../game-table/GameTable.vue";
import { partyKey, throwsKey } from "../game-table/hooks";
import { useGameMembersQuery, useGameQuery, useSelectGameCharacterMutation } from "./hooks";
import { gameClassCatalogKey } from "../class-progression/hooks";
import { newUuid } from "../../shared/uuid";

const toast = useToast();
const route = useRoute();
const router = useRouter();
const gamePath = `/games/${String(route.params.gameId)}`;
const gameId = String(route.params.gameId);
const game = useGameQuery(gameId);
const queryClient = useQueryClient();
const membersQuery = useGameMembersQuery(gameId);
const roster = useGameCharactersQuery(gameId);
useQueryErrorToast(game, tr("ui.couldNotOpenThisGameReturnToYourGames"));
useQueryErrorToast(roster, tr("ui.couldNotLoadCharactersTryAgain"));
useQueryErrorToast(membersQuery, tr("ui.couldNotLoadMembershipDetailsTryAgain"));
const createCharacter = useCreateGameCharacterMutation(gameId);
const setActive = useGameCharacterActiveMutation(gameId);
const selectCharacter = useSelectGameCharacterMutation(gameId);
const assignCharacter = useAssignGameCharacterMutation(gameId);
const deleteCharacter = useDeleteGameCharacterMutation(gameId);
const gameRecord = computed(() => game.data.value?.game);
const characters = computed(() => roster.data.value?.characters ?? []);
const members = computed(() => membersQuery.data.value?.members ?? []);
const currentMember = computed(() =>
  members.value.find((member) => member.accountId === account.value?.id && !member.removed),
);
const activeTabs = computed(() =>
  [...characters.value]
    .filter((character) => character.active)
    .sort((a, b) => Number(b.canEdit) - Number(a.canEdit))
    .map((character) => ({
      label: character.name,
      value: character.id,
    })),
);
const selectedId = ref("");
const management = computed(
  () => route.name === "game-characters" || route.name === "game-character",
);
const settings = computed(() => route.name === "game-settings");
const managedCharacterId = computed(() => String(route.params.characterId ?? ""));
const createOpen = ref(false);
const characterName = ref("");
const createError = ref("");
const removingId = ref("");
const removingCharacter = computed(() =>
  characters.value.find((character) => character.id === removingId.value),
);
const managedCharacter = computed(() =>
  characters.value.find((character) => character.id === managedCharacterId.value),
);
const pendingId = ref<string | null>(null);
const pendingName = ref("");
const heading = ref<HTMLElement>();
const throwsHint = ref(0);
const npcsHint = ref(0);
const { games: gamesApi } = useApiServices();
let events: ReturnType<typeof gamesApi.openGameEvents> | undefined;
let eventConnectionFailed = false;

function refreshGameQueries(characterId?: string) {
  const prefix = ["accounts", account.value?.id, "games", gameId];
  void queryClient.invalidateQueries({ queryKey: [...prefix, "characters"], exact: !characterId });
  if (characterId)
    void queryClient.invalidateQueries({ queryKey: [...prefix, "characters", characterId] });
  void queryClient.invalidateQueries({ queryKey: [...prefix, "members"] });
  void queryClient.invalidateQueries({ queryKey: partyKey(gameId) });
  throwsHint.value += 1;
  npcsHint.value += 1;
}
onMounted(() => {
  events = gamesApi.openGameEvents(gameId);
  events.onopen = () => {
    eventConnectionFailed = false;
    refreshGameQueries(managedCharacterId.value || selectedId.value || undefined);
    void queryClient.invalidateQueries({ queryKey: gameClassCatalogKey(gameId) });
  };
  events.onmessage = (event) => {
    try {
      const hint = JSON.parse(event.data) as { type?: string; characterId?: string };
      if (hint.type === "roster") {
        refreshGameQueries();
        void queryClient.invalidateQueries({ queryKey: gameClassCatalogKey(gameId) });
      }
      if (hint.type === "sheet" && hint.characterId) refreshGameQueries(hint.characterId);
      if (hint.type === "npcs") npcsHint.value += 1;
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
      toast.add({
        title: tr("ui.liveUpdatesDisconnectedReconnectingAutomatically"),
        color: "error",
      });
      eventConnectionFailed = true;
    }
    void game.refetch();
    void roster.refetch();
    refreshGameQueries();
  };
});
onUnmounted(() => events?.close());

watch(
  activeTabs,
  (tabs) => {
    if (!tabs.some((tab) => tab.value === selectedId.value))
      selectedId.value = tabs[0]?.value ?? "";
  },
  { immediate: true },
);

async function focusHeading() {
  await nextTick();
  heading.value?.focus();
}
watch(heading, () => {
  if (management.value || settings.value) void focusHeading();
});
function refreshSettings() {
  void membersQuery.refetch();
  void roster.refetch();
}
function openSheet(characterId: string) {
  void router.push(`${gamePath}/characters/${characterId}`);
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
    createError.value = tr("ui.enterACharacterName");
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
    const created = refreshed.data?.characters.find(
      (character) => character.id === result.character.id,
    );
    if (created?.active) await router.push(gamePath);
    else await router.push(`${gamePath}/characters/${result.character.id}`);
  } catch {
    toast.add({
      title: tr("ui.couldNotConfirmCharacterCreationSubmitAgainToSafely"),
      color: "error",
    });
  }
}
async function changeActive(characterId: string, active: boolean) {
  try {
    const character = characters.value.find((entry) => entry.id === characterId);
    if (!character) throw new Error(tr("ui.characterUnavailable"));
    if (gameRecord.value?.role === "GM" && !character.controllerMembershipId) {
      await setActive.mutateAsync({ characterId, active });
    } else {
      const member =
        gameRecord.value?.role === "GM"
          ? members.value.find(
              (entry) => entry.id === character.controllerMembershipId && !entry.removed,
            )
          : currentMember.value;
      if (!member) throw new Error(tr("ui.membershipUnavailable"));
      await selectCharacter.mutateAsync({
        characterId: active ? characterId : null,
        expectedRevision: member.revision,
        ...(gameRecord.value?.role === "GM" ? { membershipId: member.id } : {}),
      });
    }
  } catch {
    toast.add({ title: tr("ui.couldNotUpdateTheActiveCharacterTryAgain"), color: "error" });
  }
}
async function assign(characterId: string, membershipId: string | null) {
  try {
    await assignCharacter.mutateAsync({ characterId, membershipId });
    await membersQuery.refetch();
  } catch {
    toast.add({ title: tr("ui.couldNotUpdateCharacterControlTryAgain"), color: "error" });
  }
}
async function removeCharacter() {
  if (!removingId.value) return;
  try {
    await deleteCharacter.mutateAsync(removingId.value);
    removingId.value = "";
    await membersQuery.refetch();
  } catch {
    toast.add({ title: tr("ui.couldNotRemoveTheCharacterTryAgain"), color: "error" });
  }
}
</script>

<template>
  <div data-testid="game-view" class="mx-auto max-w-6xl space-y-section">
    <SkeletonRegion
      v-if="game.isLoading.value"
      :label="tr('ui.loadingGame')"
      class="space-y-section"
    >
      <div class="flex flex-wrap items-start justify-between gap-medium">
        <div class="space-y-tight">
          <SkeletonBlock class="h-9 w-44" /><SkeletonBlock class="h-5 w-32" />
        </div>
        <div v-if="!settings && !management" class="flex gap-small">
          <SkeletonBlock class="h-8 w-28" /><SkeletonBlock class="h-8 w-36" />
        </div>
      </div>
      <GameBodySkeleton
        :settings="settings"
        :management="management"
        :character-id="managedCharacterId"
      />
    </SkeletonRegion>
    <ContentState v-else-if="game.isError.value" kind="error" @retry="game.refetch" />
    <template v-else-if="gameRecord">
      <header class="flex flex-wrap items-start justify-between gap-medium">
        <div>
          <h1
            ref="heading"
            tabindex="-1"
            class="text-heading font-semibold"
            data-testid="game-heading"
          >
            {{
              settings
                ? tr("ui.settings")
                : management
                  ? managedCharacterId
                    ? tr("ui.characterSheet")
                    : tr("ui.charactersManagement")
                  : gameRecord.name
            }}
          </h1>
          <p class="text-muted">
            {{ gameRecord.system.name }} · {{ tr(`ui.${gameRecord.role.toLowerCase()}`) }}
          </p>
        </div>
        <div class="flex flex-wrap gap-small">
          <UButton
            v-if="!management && !settings"
            :to="`/games/${gameId}/classes`"
            data-testid="open-game-classes"
            color="neutral"
            variant="outline"
            >{{ tr("ui.gameClasses") }}</UButton
          >
          <UButton
            v-if="!management && !settings"
            data-testid="manage-characters"
            color="neutral"
            variant="outline"
            :to="`${gamePath}/characters`"
            >{{ tr("ui.charactersManagement") }}</UButton
          >
          <UButton
            v-if="!management && !settings && gameRecord.role === 'GM'"
            color="neutral"
            variant="outline"
            data-testid="open-settings"
            :to="`${gamePath}/settings`"
            >{{ tr("ui.settings") }}</UButton
          >
        </div>
      </header>
      <SkeletonRegion
        v-if="(settings || management) && (roster.isLoading.value || membersQuery.isLoading.value)"
        :label="tr('ui.loadingCharacters')"
      >
        <GameBodySkeleton
          :settings="settings"
          :management="management"
          :character-id="managedCharacterId"
        />
      </SkeletonRegion>
      <ContentState
        v-else-if="(settings || management) && roster.isError.value"
        kind="error"
        @retry="roster.refetch"
      />
      <template v-else>
        <ContentState v-if="settings && gameRecord.role !== 'GM'" kind="empty">
          {{ tr("ui.settingsAreOnlyAvailableToTheGmOfThis") }}
        </ContentState>
        <GameSettings
          v-else-if="settings"
          :game-id="gameId"
          :members="members"
          :characters="characters"
          @changed="refreshSettings"
        />
        <template v-else-if="management && managedCharacterId">
          <CharacterView
            :key="managedCharacterId"
            :game-id="gameId"
            :character-id="managedCharacterId"
            :read-only="gameRecord.role !== 'GM' && !managedCharacter?.canEdit"
          />
        </template>
        <template v-else-if="management">
          <div class="flex justify-end">
            <UButton data-testid="create-character" @click="openCreate">{{
              tr("ui.createCharacter")
            }}</UButton>
          </div>
          <p v-if="membersQuery.isError.value" role="alert">
            <UButton variant="outline" color="neutral" @click="membersQuery.refetch">{{
              tr("games.retry")
            }}</UButton>
          </p>
          <CharacterManagement
            v-else
            :characters="characters"
            :members="members"
            :role="gameRecord.role"
            :pending="
              setActive.isPending.value ||
              selectCharacter.isPending.value ||
              assignCharacter.isPending.value ||
              deleteCharacter.isPending.value
            "
            @open="openSheet"
            @set-active="changeActive"
            @assign="assign"
            @remove="removingId = $event"
          />
        </template>
        <template v-else>
          <AgentTable
            v-if="gameRecord.role === 'GM' && account"
            :key="gameId + account.id"
            :game-id="gameId"
            :throws-hint="throwsHint"
            :npcs-hint="npcsHint"
          />
          <GameTable
            v-else
            :game-id="gameId"
            :role="gameRecord.role"
            :throws-hint="throwsHint"
            :npcs-hint="npcsHint"
          />
        </template>
      </template>
    </template>
    <CreateFormDialog
      v-model:open="createOpen"
      :title="tr('ui.createACharacter')"
      :submit-label="tr('ui.createCharacter')"
      submit-test-id="confirm-create-character"
      :pending="createCharacter.isPending.value"
      @submit="submitCharacter"
    >
      <LabeledInput
        :label="tr('ui.characterName')"
        :error="createError"
        v-model="characterName"
        :disabled="createCharacter.isPending.value"
        data-testid="character-name"
      />
    </CreateFormDialog>
    <ConfirmDialog
      :open="Boolean(removingId)"
      :title="tr('ui.removeCharacter')"
      :confirm-label="tr('ui.removePermanently')"
      confirm-test-id="confirm-character-removal"
      destructive
      :pending="deleteCharacter.isPending.value"
      @cancel="removingId = ''"
      @confirm="removeCharacter"
    >
      <p>
        {{
          tr("ui.removeValue1ThisPermanentlyRemovesTheCharacterAndIts", {
            value1: removingCharacter?.name,
          })
        }}
      </p>
    </ConfirmDialog>
  </div>
</template>
