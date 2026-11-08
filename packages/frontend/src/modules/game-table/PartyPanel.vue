<script setup lang="ts">
import { useId } from "vue";
import ContentState from "../../shared/design-system/ContentState.vue";
import ScreenSection from "../../shared/design-system/ScreenSection.vue";
import type { Attribute, PartyCharacter } from "./types";
import PartyCharacterCard from "./PartyCharacterCard.vue";

defineProps<{
  party: readonly PartyCharacter[];
  isLoading?: boolean;
  isError?: boolean;
  weaponHint?: { character: PartyCharacter; weaponName: string } | null;
}>();
const headingId = useId();
const emit = defineEmits<{
  rollAttribute: [character: PartyCharacter, attribute: Attribute];
  rollWeapon: [character: PartyCharacter, weaponId: string];
  needsWeaponSetup: [character: PartyCharacter, weaponId: string];
  retry: [];
  openSheet: [characterId: string];
}>();
</script>

<template>
  <ScreenSection :aria-labelledby="headingId" class="p-large">
    <h2 :id="headingId" class="text-section font-semibold">Active party</h2>
    <ContentState v-if="isLoading" kind="loading">Loading party…</ContentState>
    <ContentState
      v-else-if="isError"
      kind="error"
      retry-test-id="retry-party"
      @retry="emit('retry')"
    />
    <ul
      v-else-if="party.length"
      class="grid gap-small pt-medium sm:grid-cols-2"
      data-testid="party-list"
    >
      <PartyCharacterCard
        v-for="member in party"
        :key="member.id"
        :member="member"
        @roll-attribute="emit('rollAttribute', member, $event)"
        @roll-weapon="emit('rollWeapon', member, $event)"
        @needs-weapon-setup="emit('needsWeaponSetup', member, $event)"
      />
    </ul>
    <p v-else class="text-muted" data-testid="party-empty">No active characters.</p>
    <p v-if="weaponHint" role="alert" class="text-error pt-medium" data-testid="weapon-setup-hint">
      Set both attributes and the accuracy bonus for {{ weaponHint.weaponName }} on the character
      sheet.
      <UButton
        variant="link"
        data-testid="open-sheet-for-weapon"
        @click="emit('openSheet', weaponHint.character.id)"
        >Open character sheet</UButton
      >
    </p>
  </ScreenSection>
</template>
