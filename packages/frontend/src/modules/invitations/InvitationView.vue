<script setup lang="ts">
import { tr } from "../../shared/i18n";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import type { InvitationPreview } from "./types";
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
      title: tr("ui.thisInvitationIsUnavailableAskTheGmForAn"),
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
    const gamePath = `/games/${result.gameId}`;
    await router.replace(
      inactiveCharacter ? `${gamePath}/characters/${inactiveCharacter}` : gamePath,
    );
  } catch {
    toast.add({
      title: tr("ui.thisInvitationCouldNotBeAcceptedAskTheGm"),
      color: "error",
    });
  } finally {
    accepting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-section">
    <h1 class="text-heading font-semibold">{{ tr("ui.gameInvitation") }}</h1>
    <SkeletonRegion v-if="loading" :label="tr('ui.loadingInvitation')" class="space-y-section">
      <SkeletonBlock class="h-6 w-4/5" />
      <div class="flex gap-small">
        <SkeletonBlock class="h-8 w-24" /><SkeletonBlock class="h-8 w-20" />
      </div>
    </SkeletonRegion>
    <template v-else-if="unavailable">
      <UButton to="/" color="neutral" variant="outline">{{ tr("ui.myGames") }}</UButton>
    </template>
    <template v-else-if="invitation">
      <p v-if="invitation.kind === 'character'">
        {{ tr("ui.youHaveBeenInvitedToControl") }} <strong>{{ invitation.characterName }}</strong>
        {{ tr("ui.in") }} <strong>{{ invitation.gameName }}</strong
        >.
      </p>
      <p v-else>
        {{ tr("ui.youHaveBeenInvitedToJoin") }} <strong>{{ invitation.gameName }}</strong
        >.
      </p>
      <UCheckbox
        v-if="isCharacter"
        v-model="makeActive"
        :disabled="accepting"
        :label="tr('ui.makeThisCharacterActive')"
      />
      <div class="flex flex-wrap gap-small">
        <UButton :loading="accepting" data-testid="accept-invitation" @click="accept">{{
          isCharacter ? tr("ui.acceptCharacter") : tr("ui.joinGame")
        }}</UButton>
        <UButton to="/" color="neutral" variant="outline">{{ tr("ui.myGames") }}</UButton>
      </div>
    </template>
  </div>
</template>
