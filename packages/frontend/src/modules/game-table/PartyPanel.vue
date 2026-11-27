<script setup lang="ts">
import { computed, useId } from "vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import TableCardSkeleton from "./TableCardSkeleton.vue";
import type { Attribute, PartyCharacter } from "./types";
import PartyClassSummary from "../class-progression/PartyClassSummary.vue";
import PlayerEquipment from "./PlayerEquipment.vue";
import PartyCharacterCard from "./PartyCharacterCard.vue";

const props = defineProps<{
  party: readonly PartyCharacter[];
  gameId?: string;
  playerCharacter?: PartyCharacter | null;
  isLoading?: boolean;
  isError?: boolean;
  weaponHint?: { character: PartyCharacter; weaponName: string } | null;
}>();
const headingId = useId();
const sections = computed(() => {
  const own = props.playerCharacter;
  if (!own || props.isLoading || props.isError)
    return [{ title: "Table", members: props.party, featured: false }];
  return [
    { title: "Your character", members: [own], featured: true },
    {
      title: "Table",
      members: props.party.filter((member) => member.id !== own.id),
      featured: false,
    },
  ];
});
const emit = defineEmits<{
  rollAttribute: [character: PartyCharacter, attribute: Attribute];
  rollWeapon: [character: PartyCharacter, weaponId: string];
  needsWeaponSetup: [character: PartyCharacter, weaponId: string];
  retry: [];
  openSheet: [characterId: string];
}>();
</script>

<template>
  <div :class="{ 'player-layout': sections.length > 1 }">
    <component
      :is="section.featured ? 'section' : ScreenSection"
      v-for="section in sections"
      :key="section.title"
      :aria-labelledby="headingId + (section.featured ? '-player' : '-table')"
      :class="section.featured ? 'min-w-0' : 'p-large'"
    >
      <h2
        v-if="!section.featured"
        :id="headingId + (section.featured ? '-player' : '-table')"
        class="text-section font-semibold"
      >
        {{ section.title }}
      </h2>
      <SkeletonRegion
        v-if="isLoading"
        label="Loading party…"
        class="party-grid table-cards-compact grid grid-cols-2 pt-small md:grid-cols-3 lg:grid-cols-4"
      >
        <TableCardSkeleton v-for="card in 2" :key="card" />
      </SkeletonRegion>
      <ContentState
        v-else-if="isError"
        kind="error"
        retry-test-id="retry-party"
        @retry="emit('retry')"
      />
      <ul
        v-else
        class="relative grid"
        :class="
          section.featured
            ? 'featured-character table-cards-featured'
            : 'party-grid table-cards-compact grid-cols-2 pt-small md:grid-cols-3 lg:grid-cols-4'
        "
        :data-testid="section.featured ? 'player-character' : 'party-list'"
      >
        <PartyCharacterCard
          v-for="member in section.members"
          :key="member.id"
          :member="member"
          :player-label-id="section.featured ? headingId + '-player' : undefined"
          :can-edit="Boolean(gameId && member.canRoll)"
          :can-view="Boolean(gameId)"
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
          <template v-if="section.featured && gameId" #equipment>
            <PlayerEquipment :game-id="gameId" :character-id="member.id" />
          </template>
        </PartyCharacterCard>
        <slot v-if="!section.featured" />
      </ul>
      <p
        v-if="!isLoading && !isError && !party.length"
        class="text-muted"
        data-testid="party-empty"
      >
        No active characters.
      </p>
      <p
        v-if="playerCharacter && !section.featured && !isLoading && !isError"
        class="empty-player-table text-muted"
      >
        No other characters or NPCs at the table.
      </p>
      <p
        v-if="
          weaponHint && section.members.some((member) => member.id === weaponHint?.character.id)
        "
        role="alert"
        class="text-error pt-medium"
        data-testid="weapon-setup-hint"
      >
        Set both attributes and the accuracy bonus for {{ weaponHint.weaponName }} on the character
        sheet.
        <UButton
          variant="link"
          data-testid="open-sheet-for-weapon"
          @click="emit('openSheet', weaponHint.character.id)"
          >Open character sheet</UButton
        >
      </p>
    </component>
  </div>
</template>

<style scoped>
.player-layout {
  display: grid;
  align-items: start;
  gap: var(--spacing-medium);
}
.featured-character {
  min-width: 0;
  overflow-wrap: anywhere;
}
.empty-player-table {
  display: none;
}
.party-grid:not(:has(> .table-card, > [role="status"])) + .empty-player-table {
  display: block;
}
@media (min-width: 64rem) {
  .player-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  }
  .player-layout .party-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.party-grid {
  gap: var(--table-card-grid-gap);
}
.party-grid > :deep(.table-card) {
  container-type: inline-size;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: var(--table-card-body-size);
  line-height: 1.3;
}
</style>
