<script setup lang="ts">
import { tr } from "../../shared/i18n";
import type { Attribute, PartyWeapon } from "./types";
import DieIcon from "../../shared/design-system/domain/DieIcon.vue";

defineProps<{
  weapon: PartyWeapon;
  baseDice: Record<Attribute, number>;
  characterName: string;
  canRoll: boolean;
  reach?: "melee" | "ranged" | null;
  damageBonus?: number | null;
  damageType?: string | null;
}>();
const emit = defineEmits<{ roll: []; needsSetup: [] }>();
</script>

<template>
  <UTooltip
    :text="
      weapon.ready
        ? tr('ui.rollAccuracyWithValue1', { value1: weapon.name })
        : tr('ui.setBothAttributesAndTheAccuracyBonusForValue12', { value1: weapon.name })
    "
    :content="{ side: 'top' }"
  >
    <button
      type="button"
      class="weapon-card"
      :data-testid="`roll-weapon`"
      :aria-label="
        tr('ui.rollAccuracyForValue1UsingValue2', { value1: characterName, value2: weapon.name })
      "
      :aria-description="reach ? tr('ui.reachValue1', { value1: reach }) : undefined"
      :disabled="!canRoll"
      @click="weapon.ready ? emit('roll') : emit('needsSetup')"
    >
      <span>{{ weapon.name }}</span>
      <span class="flex flex-wrap items-center gap-card-gap">
        <span
          v-if="reach"
          :title="reach === 'melee' ? tr('ui.melee') : tr('ui.ranged')"
          class="inline-flex"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4 text-muted"
            aria-hidden="true"
          >
            <path v-if="reach === 'melee'" d="m4 20 5-5m-3-3 6 6m-4-5L18 3h3v3L11 16" />
            <path v-else d="M4 4q16 0 16 16L4 4Zm1 15L19 5m-5 0h5v5" />
          </svg>
        </span>
        <span v-if="damageBonus != null" class="text-card-label text-muted">
          +{{ damageBonus }}{{ damageType ? ` ${damageType}` : "" }}
        </span>
        <span v-if="weapon.accuracyDice.every(Boolean)" class="weapon-dice" aria-hidden="true">
          <span v-for="(attribute, index) in weapon.accuracyDice" :key="index" class="weapon-die">
            <template v-if="attribute"
              ><DieIcon :sides="baseDice[attribute]" /><span>{{ attribute }}</span></template
            >
          </span>
        </span>
      </span>
    </button>
  </UTooltip>
</template>

<style scoped>
.weapon-card {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--table-card-gap);
  padding: var(--table-card-gap);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  text-align: left;
  cursor: pointer;
}
.weapon-dice,
.weapon-die {
  display: inline-flex;
  align-items: center;
  gap: var(--table-card-detail-gap);
}
.weapon-dice {
  gap: var(--table-card-detail-gap);
}
.weapon-die {
  font-size: var(--table-card-label-size);
  font-weight: 700;
}
.weapon-card:hover:not(:disabled) {
  border-color: var(--ui-primary);
}
.weapon-card:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
.weapon-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
:deep(.die-icon) {
  width: 1.1rem;
  height: 1.1rem;
}
</style>
