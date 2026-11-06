<script setup lang="ts">
import { ref } from "vue";
import ScreenSection from "../../src/shared/design-system/ScreenSection.vue";
import type { InvitationStatus } from "./model";

defineProps<{
  gameName: string;
  characterName?: string;
  status: InvitationStatus;
  removed: boolean;
  member: boolean;
  signedIn: boolean;
}>();
const emit = defineEmits<{ signIn: []; accept: [makeActive: boolean]; back: [] }>();
const makeActive = ref(true);
</script>

<template>
  <ScreenSection class="mx-auto max-w-xl space-y-large p-section">
    <p class="font-medium text-muted">Game invitation</p>
    <h1 tabindex="-1" class="text-heading font-semibold">
      {{ signedIn && status === "Enabled" && !removed ? gameName : "You’ve been invited" }}
    </h1>
    <template v-if="!signedIn">
      <p class="text-muted">Sign in or create an account to review the invitation.</p>
      <UButton @click="emit('signIn')">Continue with sample account</UButton>
    </template>
    <template v-else-if="removed || status !== 'Enabled'">
      <p role="alert" class="text-muted">This invitation is unavailable. Ask the GM for help.</p>
      <UButton color="neutral" variant="outline" @click="emit('back')">{{
        member ? "Return to game" : "My games"
      }}</UButton>
    </template>
    <template v-else>
      <p v-if="characterName">
        Accept control of <strong>{{ characterName }}</strong
        >{{ member ? "." : " and join as a player." }}
      </p>
      <p v-else>Join as a player. You can create a character after joining.</p>
      <UCheckbox v-if="characterName" v-model="makeActive" label="Make this character active" />
      <div class="flex flex-wrap gap-small">
        <UButton @click="emit('accept', makeActive)">
          {{
            characterName
              ? member
                ? "Accept character"
                : "Join and accept character"
              : "Join game"
          }}
        </UButton>
        <UButton variant="outline" color="neutral" @click="emit('back')">Cancel</UButton>
      </div>
    </template>
  </ScreenSection>
</template>
