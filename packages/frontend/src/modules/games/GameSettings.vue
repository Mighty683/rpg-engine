<script setup lang="ts">
import { tr } from "../../shared/i18n";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import LabeledSelect from "../../shared/design-system/base/LabeledSelect.vue";
import type { GameCharacterSummary } from "../characters/types";
import type { GameInvitation } from "../invitations/types";
import type { GameMember } from "./types";

import { computed, ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { useToast } from "@nuxt/ui/composables";
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { account } from "../auth/session";
import { useApiServices } from "../../shared/api-services";
import ConfirmDialog from "../../shared/design-system/base/ConfirmDialog.vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import PlayerAccessRow from "./PlayerAccessRow.vue";
import InvitationLinkCard from "../invitations/InvitationLinkCard.vue";
import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";

const props = defineProps<{
  gameId: string;
  members: GameMember[];
  characters: GameCharacterSummary[];
}>();
const emit = defineEmits<{ changed: [] }>();
const { games: api, invitations: invitationApi } = useApiServices();
const client = useQueryClient();
const toast = useToast();
const key = computed(() => ["accounts", account.value?.id, "games", props.gameId, "invitations"]);
const invitations = useQuery({
  queryKey: key,
  queryFn: () => invitationApi.listGameInvitations(props.gameId),
});
useQueryErrorToast(invitations, tr("ui.couldNotLoadInvitationsTryAgain"));
const rows = computed(() => invitations.data.value?.invitations ?? []);
const availableCharacters = computed(() =>
  props.characters
    .filter((character) => character.controllerMembershipId === null)
    .map((character) => ({ label: character.name, value: character.id })),
);
const selectedCharacterId = ref("");
const removingMember = ref<GameMember | null>(null);
const pending = ref(false);
async function perform(action: () => Promise<unknown>, success: string) {
  if (pending.value) return;
  pending.value = true;
  try {
    await action();
    await client.invalidateQueries({ queryKey: key.value });
    emit("changed");
    toast.add({ title: success, color: "success" });
  } catch (cause) {
    const status = (cause as { status?: number })?.status;
    const description =
      status === 403
        ? tr("ui.youDoNotHavePermissionToMakeThisChange")
        : status === 404 || status === 409
          ? tr("ui.theGameOrInvitationChangedRefreshThePageAnd")
          : tr("ui.theChangeCouldNotBeConfirmedRefreshThePage");
    toast.add({ title: tr("ui.couldNotUpdateGameSettings"), description, color: "error" });
    void client.invalidateQueries({ queryKey: key.value });
  } finally {
    pending.value = false;
  }
}
function create(kind: "game" | "character") {
  if (kind === "character" && !selectedCharacterId.value) {
    toast.add({ title: tr("ui.selectACharacterToCreateAnInvitationLink"), color: "error" });
    return;
  }
  void perform(
    () =>
      invitationApi.createGameInvitation(props.gameId, {
        kind,
        ...(kind === "character" ? { characterId: selectedCharacterId.value } : {}),
      }),
    tr("ui.invitationCreated"),
  );
}
function toggle(invitation: GameInvitation) {
  void perform(
    () => invitationApi.updateGameInvitation(props.gameId, invitation.id, !invitation.enabled),
    tr("ui.invitationUpdated"),
  );
}
function rotate(invitation: GameInvitation) {
  void perform(
    () => invitationApi.rotateGameInvitation(props.gameId, invitation.id),
    tr("ui.invitationLinkReplaced"),
  );
}
async function copy(invitation: GameInvitation) {
  try {
    await navigator.clipboard.writeText(invitationUrl(invitation));
    toast.add({ title: tr("ui.invitationLinkCopied"), color: "success" });
  } catch {
    toast.add({
      title: tr("ui.couldNotCopyTheLink"),
      description: tr("ui.selectAndCopyItInstead"),
      color: "error",
    });
  }
}
function invitationUrl(invitation: GameInvitation) {
  return new URL(invitation.url, window.location.origin).href;
}
function changeMember(member: GameMember, action: "remove" | "restore") {
  void perform(
    () => api.setGameMembership(props.gameId, member.id, action),
    action === "remove" ? tr("ui.playerAccessRemoved") : tr("ui.playerAccessRestored"),
  );
  removingMember.value = null;
}
function characterName(id: string | null) {
  return props.characters.find((character) => character.id === id)?.name ?? tr("ui.character");
}
</script>

<template>
  <div class="space-y-section">
    <ScreenSection class="space-y-medium p-large">
      <h2 class="text-section font-semibold">{{ tr("ui.players") }}</h2>
      <ContentState v-if="!members.length" kind="empty">{{
        tr("ui.noPlayersHaveJoinedThisGameYet")
      }}</ContentState>
      <ul v-else class="space-y-small">
        <PlayerAccessRow
          v-for="member in members"
          :key="member.id"
          :name="member.name"
          :removed="member.removed"
          :pending="pending"
          @remove="removingMember = member"
          @restore="changeMember(member, 'restore')"
        />
      </ul>
    </ScreenSection>
    <ScreenSection class="space-y-medium p-large">
      <h2 class="text-section font-semibold">{{ tr("ui.invitations") }}</h2>
      <SkeletonRegion
        v-if="invitations.isLoading.value"
        :label="tr('ui.loadingInvitations')"
        class="space-y-medium"
      >
        <SkeletonBlock class="h-8 w-32" />
        <div class="space-y-small">
          <SkeletonBlock class="w-32" />
          <div class="flex gap-small">
            <SkeletonBlock class="h-8 w-44" /><SkeletonBlock class="h-8 w-20" />
          </div>
        </div>
      </SkeletonRegion>
      <ContentState
        v-else-if="invitations.isError.value"
        kind="error"
        @retry="invitations.refetch"
      />
      <template v-else>
        <UButton
          v-if="!rows.some((row) => row.kind === 'game')"
          :disabled="pending"
          @click="create('game')"
          >{{ tr("ui.createGameLink") }}</UButton
        >
        <ul class="space-y-medium">
          <InvitationLinkCard
            v-for="invitation in rows"
            :key="invitation.id"
            :title="
              invitation.kind === 'game'
                ? tr('ui.gameLink')
                : tr('ui.value1CharacterLink', { value1: characterName(invitation.characterId) })
            "
            :url="invitationUrl(invitation)"
            :enabled="invitation.enabled"
            :pending="pending"
            @copy="copy(invitation)"
            @toggle="toggle(invitation)"
            @rotate="rotate(invitation)"
          />
        </ul>
        <form class="flex flex-wrap items-end gap-small" @submit.prevent="create('character')">
          <LabeledSelect
            :label="tr('ui.createCharacterLink')"
            v-model="selectedCharacterId"
            :items="availableCharacters"
            :disabled="pending || !availableCharacters.length"
            :placeholder="tr('ui.selectCharacter')"
          />
          <UButton
            type="submit"
            :disabled="pending || !availableCharacters.length"
            :loading="pending"
            >{{ tr("ui.createLink") }}</UButton
          >
        </form>
      </template>
    </ScreenSection>
    <ConfirmDialog
      :open="Boolean(removingMember)"
      :title="tr('ui.removePlayerAccess')"
      :confirm-label="tr('ui.removeAccess')"
      destructive
      :pending="pending"
      @cancel="removingMember = null"
      @confirm="removingMember && changeMember(removingMember, 'remove')"
    >
      <p>
        {{
          tr("ui.removeValue1FromTheGameTheirCharactersStayIn", { value1: removingMember?.name })
        }}
      </p>
    </ConfirmDialog>
  </div>
</template>
