<script setup lang="ts">
import type { Attribute, PartyWeapon } from "./types";
import DieIcon from "../../shared/design-system/DieIcon.vue";

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
        ? `Roll accuracy with ${weapon.name}`
        : `Set both attributes and the accuracy bonus for ${weapon.name} on the character sheet`
    "
    :content="{ side: 'top' }"
  >
    <button
      type="button"
      class="weapon-card"
      :data-testid="`roll-weapon`"
      :aria-label="`Roll accuracy for ${characterName} using ${weapon.name}`"
      :disabled="!canRoll"
      @click="weapon.ready ? emit('roll') : emit('needsSetup')"
    >
      <span>{{ weapon.name }}</span>
      <span class="flex items-center gap-small">
        <span
          v-if="reach && damageBonus !== null && damageBonus !== undefined"
          class="text-label text-muted"
          >{{ reach }} · high roll +{{ damageBonus }}{{ damageType ? ` ${damageType}` : "" }}</span
        >
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
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem;
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
  gap: 0.125rem;
}
.weapon-dice {
  gap: 0.25rem;
}
.weapon-die {
  font-size: 0.625rem;
  font-weight: 700;
}
.weapon-card:hover:not(:disabled) {
  border-color: var(--ui-primary);
}
.weapon-card:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
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
