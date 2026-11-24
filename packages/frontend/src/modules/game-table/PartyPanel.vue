<script setup lang="ts">
import { useId } from "vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";
import type { Attribute, PartyCharacter } from "./types";
import PartyClassSummary from "../class-progression/PartyClassSummary.vue";
import PartyCharacterCard from "./PartyCharacterCard.vue";

defineProps<{
  party: readonly PartyCharacter[];
  gameId?: string;
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
    <h2 :id="headingId" class="text-section font-semibold">Table</h2>
    <ContentState v-if="isLoading" kind="loading">Loading party…</ContentState>
    <ContentState
      v-else-if="isError"
      kind="error"
      retry-test-id="retry-party"
      @retry="emit('retry')"
    />
    <ul
      v-else
      class="party-grid relative grid grid-cols-2 pt-small md:grid-cols-3 lg:grid-cols-4"
      data-testid="party-list"
    >
      <PartyCharacterCard
        v-for="member in party"
        :key="member.id"
        :member="member"
        :can-edit="Boolean(gameId && member.canRoll)"
        @edit="emit('openSheet', member.id)"
        @roll-attribute="emit('rollAttribute', member, $event)"
        @roll-weapon="emit('rollWeapon', member, $event)"
        @needs-weapon-setup="emit('needsWeaponSetup', member, $event)"
      >
        <template v-if="gameId" #class-progression>
          <PartyClassSummary
            :game-id="gameId"
            :member="member"
            @open-sheet="emit('openSheet', member.id)"
          />
        </template>
      </PartyCharacterCard>
      <slot />
    </ul>
    <p v-if="!isLoading && !isError && !party.length" class="text-muted" data-testid="party-empty">
      No active characters.
    </p>
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

<style scoped>
.party-grid {
  gap: var(--table-card-grid-gap);
}
.party-grid > :deep(.table-card) {
  --spacing-medium: var(--table-card-padding);
  --spacing-small: var(--table-card-gap);
  --spacing-tight: var(--table-card-detail-gap);
  --spacing-field: var(--table-card-bar-height);
  --text-label: var(--table-card-label-size);
  --text-small: var(--table-card-body-size);
  --text-section: var(--table-card-title-size);
  --text-section--line-height: 1.25;
  --dice-label-size: var(--table-card-label-size);
  --dice-control-padding: var(--table-card-detail-gap);
  --dice-control-gap: var(--table-card-detail-gap);

  container-type: inline-size;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: var(--table-card-body-size);
  line-height: 1.3;
}
</style>
