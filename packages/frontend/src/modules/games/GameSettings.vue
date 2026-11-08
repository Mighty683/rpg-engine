<script setup lang="ts">
import type { GameCharacterSummary } from "../characters/types";
import type { GameInvitation } from "../invitations/types";
import type { GameMember } from "./types";

import { computed, ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { useToast } from "@nuxt/ui/composables";
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { account } from "../auth/session";

import { invitationApi } from "../invitations/api";
import { api } from "./api";
import ScreenSection from "../../shared/design-system/ScreenSection.vue";

const props = defineProps<{ gameId: string; members: GameMember[]; characters: GameCharacterSummary[] }>();
const emit = defineEmits<{ changed: [] }>();
const client = useQueryClient();
const toast = useToast();
const key = computed(() => ["accounts", account.value?.id, "games", props.gameId, "invitations"]);
const invitations = useQuery({ queryKey: key, queryFn: () => invitationApi.listGameInvitations(props.gameId) });
useQueryErrorToast(invitations, "Could not load invitations. Try again.");
const rows = computed(() => invitations.data.value?.invitations ?? []);
const availableCharacters = computed(() => props.characters.filter((character) => character.controllerMembershipId === null).map((character) => ({ label: character.name, value: character.id })));
const selectedCharacterId = ref("");
const removingMember = ref<GameMember | null>(null);
const pending = ref(false);
async function perform(action: () => Promise<unknown>, success: string) {
  pending.value = true;
  try {
    await action();
    await client.invalidateQueries({ queryKey: key.value });
    emit("changed");
    toast.add({ title: success, color: "success" });
  } catch (cause) {
    const status = (cause as { status?: number })?.status;
    const description = status === 403
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
  if (kind === "character" && !selectedCharacterId.value) return;
  void perform(() => invitationApi.createGameInvitation(props.gameId, { kind, ...(kind === "character" ? { characterId: selectedCharacterId.value } : {}) }), "Invitation created.");
}
function toggle(invitation: GameInvitation) {
  void perform(() => invitationApi.updateGameInvitation(props.gameId, invitation.id, !invitation.enabled), "Invitation updated.");
}
function rotate(invitation: GameInvitation) {
  void perform(() => invitationApi.rotateGameInvitation(props.gameId, invitation.id), "Invitation link replaced.");
}
async function copy(invitation: GameInvitation) {
  try {
    await navigator.clipboard.writeText(invitationUrl(invitation));
    toast.add({ title: "Invitation link copied.", color: "success" });
  } catch {
    toast.add({ title: "Could not copy the link", description: "Select and copy it instead.", color: "error" });
  }
}
function invitationUrl(invitation: GameInvitation) {
  return new URL(invitation.url, window.location.origin).href;
}
function changeMember(member: GameMember, action: "remove" | "restore") {
  void perform(() => api.setGameMembership(props.gameId, member.id, action), action === "remove" ? "Player access removed." : "Player access restored.");
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
      <p v-if="!members.length" class="text-muted">No players have joined this game yet.</p>
      <ul v-else class="space-y-small">
        <li v-for="member in members" :key="member.id" class="flex flex-wrap items-center justify-between gap-small">
          <span>{{ member.name }} <UBadge color="neutral" variant="subtle">{{ member.removed ? "Removed" : "Active" }}</UBadge></span>
          <UButton v-if="member.removed" color="neutral" variant="outline" :disabled="pending" @click="changeMember(member, 'restore')">Restore access</UButton>
          <UButton v-else color="error" variant="outline" :disabled="pending" @click="removingMember = member">Remove access</UButton>
        </li>
      </ul>
    </ScreenSection>
    <ScreenSection class="space-y-medium p-large">
      <h2 class="text-section font-semibold">Invitations</h2>
      <p v-if="invitations.isLoading.value">Loading invitations…</p>
      <p v-else-if="invitations.isError.value"><UButton color="neutral" variant="outline" @click="invitations.refetch">Retry</UButton></p>
      <template v-else>
        <UButton v-if="!rows.some((row) => row.kind === 'game')" :disabled="pending" @click="create('game')">Create game link</UButton>
        <ul class="space-y-medium">
          <li v-for="invitation in rows" :key="invitation.id" class="space-y-small rounded-panel border border-default p-medium">
            <div class="flex flex-wrap items-center gap-small"><strong>{{ invitation.kind === "game" ? "Game link" : `${characterName(invitation.characterId)} character link` }}</strong><UBadge color="neutral" variant="subtle">{{ invitation.enabled ? "Enabled" : "Disabled" }}</UBadge></div>
            <label class="block text-sm text-muted">Invitation link <input readonly :value="invitationUrl(invitation)" class="block w-full rounded border border-default bg-default p-small text-default" /></label>
            <div class="flex flex-wrap gap-small">
              <UButton color="neutral" variant="outline" @click="copy(invitation)">Copy</UButton>
              <UButton color="neutral" variant="outline" :disabled="pending" @click="toggle(invitation)">{{ invitation.enabled ? "Disable" : "Enable" }}</UButton>
              <UButton color="neutral" variant="outline" :disabled="pending" @click="rotate(invitation)">Rotate link</UButton>
            </div>
          </li>
        </ul>
        <form class="flex flex-wrap items-end gap-small" @submit.prevent="create('character')">
          <UFormField label="Create character link"><USelect v-model="selectedCharacterId" :items="availableCharacters" value-key="value" placeholder="Select character" /></UFormField>
          <UButton type="submit" :disabled="pending || !selectedCharacterId">Create link</UButton>
        </form>
      </template>
    </ScreenSection>
    <UModal :open="Boolean(removingMember)" title="Remove player access" @update:open="(open: boolean) => { if (!open) removingMember = null }">
      <template #body>
        <p>Remove {{ removingMember?.name }} from the game? Their characters stay in the game under GM control and become inactive.</p>
        <div class="mt-medium flex justify-end gap-small"><UButton color="neutral" variant="outline" @click="removingMember = null">Cancel</UButton><UButton color="error" @click="removingMember && changeMember(removingMember, 'remove')">Remove access</UButton></div>
      </template>
    </UModal>
  </div>
</template>
