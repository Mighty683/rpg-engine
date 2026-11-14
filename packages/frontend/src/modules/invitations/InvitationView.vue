<script setup lang="ts">
import type { InvitationPreview } from "./types";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import { useToast } from "@nuxt/ui/composables";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useApiServices } from "../../shared/api-services";

const { invitations: invitationApi } = useApiServices();

const toast = useToast();
const route = useRoute();
const router = useRouter();
const token = String(route.params.token);
const invitation = ref<InvitationPreview | null>(null);
const loading = ref(true);
const accepting = ref(false);
const unavailable = ref(false);
const makeActive = ref(true);
const isCharacter = computed(() => invitation.value?.kind === "character");

onMounted(async () => {
  try {
    invitation.value = (await invitationApi.preview(token)).invitation;
    if (invitation.value.kind === "game" && invitation.value.alreadyMember) {
      await router.replace(`/games/${invitation.value.gameId}`);
    }
  } catch {
    unavailable.value = true;
    toast.add({
      title: "This invitation is unavailable. Ask the GM for an active link.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
});
async function accept() {
  if (accepting.value) return;
  accepting.value = true;
  try {
    const result = await invitationApi.accept(token, makeActive.value);
    const inactiveCharacter =
      isCharacter.value && !makeActive.value ? result.characterId : undefined;
    await router.replace({
      path: `/games/${result.gameId}`,
      query: inactiveCharacter ? { character: inactiveCharacter } : {},
    });
  } catch {
    toast.add({
      title: "This invitation could not be accepted. Ask the GM for an active link.",
      color: "error",
    });
  } finally {
    accepting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-section">
    <h1 class="text-heading font-semibold">Game invitation</h1>
    <ContentState v-if="loading" kind="loading">Loading invitation…</ContentState>
    <template v-else-if="unavailable">
      <UButton to="/" color="neutral" variant="outline">My games</UButton>
    </template>
    <template v-else-if="invitation">
      <p v-if="isCharacter">
        You have been invited to control <strong>{{ invitation.characterName }}</strong> in
        <strong>{{ invitation.gameName }}</strong
        >.
      </p>
      <p v-else>
        You have been invited to join <strong>{{ invitation.gameName }}</strong
        >.
      </p>
      <UCheckbox
        v-if="isCharacter"
        v-model="makeActive"
        :disabled="accepting"
        label="Make this character active"
      />
      <div class="flex flex-wrap gap-small">
        <UButton :loading="accepting" data-testid="accept-invitation" @click="accept">{{
          isCharacter ? "Accept character" : "Join game"
        }}</UButton>
        <UButton to="/" color="neutral" variant="outline">My games</UButton>
      </div>
    </template>
  </div>
</template>
