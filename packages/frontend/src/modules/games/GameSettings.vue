<script setup lang="ts">
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
useQueryErrorToast(invitations, "Could not load invitations. Try again.");
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
        ? "You do not have permission to make this change."
        : status === 404 || status === 409
          ? "The game or invitation changed. Refresh the page and try again."
          : "The change could not be confirmed. Refresh the page before trying again.";
    toast.add({ title: "Could not update game settings", description, color: "error" });
    void client.invalidateQueries({ queryKey: key.value });
  } finally {
    pending.value = false;
  }
}
function create(kind: "game" | "character") {
  if (kind === "character" && !selectedCharacterId.value) {
    toast.add({ title: "Select a character to create an invitation link.", color: "error" });
    return;
  }
  void perform(
    () =>
      invitationApi.createGameInvitation(props.gameId, {
        kind,
        ...(kind === "character" ? { characterId: selectedCharacterId.value } : {}),
      }),
    "Invitation created.",
  );
}
function toggle(invitation: GameInvitation) {
  void perform(
    () => invitationApi.updateGameInvitation(props.gameId, invitation.id, !invitation.enabled),
    "Invitation updated.",
  );
}
function rotate(invitation: GameInvitation) {
  void perform(
    () => invitationApi.rotateGameInvitation(props.gameId, invitation.id),
    "Invitation link replaced.",
  );
}
async function copy(invitation: GameInvitation) {
  try {
    await navigator.clipboard.writeText(invitationUrl(invitation));
    toast.add({ title: "Invitation link copied.", color: "success" });
  } catch {
    toast.add({
      title: "Could not copy the link",
      description: "Select and copy it instead.",
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
    action === "remove" ? "Player access removed." : "Player access restored.",
  );
  removingMember.value = null;
}
function characterName(id: string | null) {
  return props.characters.find((character) => character.id === id)?.name ?? "Character";
}
</script>

<template>
  <div class="space-y-section">
    <ScreenSection class="space-y-medium p-large">
      <h2 class="text-section font-semibold">Players</h2>
      <ContentState v-if="!members.length" kind="empty"
        >No players have joined this game yet.</ContentState
      >
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
      <h2 class="text-section font-semibold">Invitations</h2>
      <ContentState v-if="invitations.isLoading.value" kind="loading"
        >Loading invitations…</ContentState
      >
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
          >Create game link</UButton
        >
        <ul class="space-y-medium">
          <InvitationLinkCard
            v-for="invitation in rows"
            :key="invitation.id"
            :title="
              invitation.kind === 'game'
                ? 'Game link'
                : `${characterName(invitation.characterId)} character link`
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
            label="Create character link"
            v-model="selectedCharacterId"
            :items="availableCharacters"
            :disabled="pending || !availableCharacters.length"
            placeholder="Select character"
          />
          <UButton
            type="submit"
            :disabled="pending || !availableCharacters.length"
            :loading="pending"
            >Create link</UButton
          >
        </form>
      </template>
    </ScreenSection>
    <ConfirmDialog
      :open="Boolean(removingMember)"
      title="Remove player access"
      confirm-label="Remove access"
      destructive
      :pending="pending"
      @cancel="removingMember = null"
      @confirm="removingMember && changeMember(removingMember, 'remove')"
    >
      <p>
        Remove {{ removingMember?.name }} from the game? Their characters stay in the game under GM
        control and become inactive.
      </p>
    </ConfirmDialog>
  </div>
</template>
