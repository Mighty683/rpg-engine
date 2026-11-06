<script setup lang="ts">
import DieIcon from "../../src/shared/design-system/DieIcon.vue";
import { dieSizes } from "./model";

export type OpponentDraft = { dice: number[]; modifier: string };
withDefaults(defineProps<{ sizes?: readonly number[]; showPool?: boolean }>(), { sizes: () => dieSizes, showPool: true });
const opponent = defineModel<OpponentDraft>({ required: true });
</script>

<template>
  <div class="opposed-setup space-y-small">
    <p class="text-sm font-medium">Opposing dice</p>
    <div class="flex flex-wrap items-center gap-small">
      <UTooltip v-for="size in sizes" :key="size" text="Maximum 2 dice" :disabled="opponent.dice.length < 2" :content="{ side: 'top' }">
        <span class="dice-trigger" :tabindex="opponent.dice.length >= 2 ? 0 : undefined"><button type="button" class="opponent-die" :aria-label="`Add opposing d${size}`" :disabled="opponent.dice.length >= 2" @click="opponent.dice.push(size)"><DieIcon :sides="size" /><span>d{{ size }}</span></button></span>
      </UTooltip>
      <label class="opponent-modifier"><span>Modifier</span><input v-model="opponent.modifier" type="number" step="1" /></label>
    </div>
    <div v-if="showPool">
      <p class="mb-small text-sm font-medium">Dice pool</p>
      <div v-if="opponent.dice.length" class="flex flex-wrap gap-small">
        <button v-for="(size, index) in opponent.dice" :key="index" type="button" class="opponent-die" :aria-label="`Remove opposing d${size}`" @click="opponent.dice.splice(index, 1)"><DieIcon :sides="size" /><span>d{{ size }}</span></button>
      </div>
      <p v-else class="text-sm text-muted">Select dice to add them to the pool.</p>
    </div>
  </div>
</template>

<style scoped>
.opposed-setup { border-top: 1px solid var(--ui-border); padding-top: var(--spacing-small); }
.opponent-die, .opponent-modifier { min-width: 2.75rem; display: grid; justify-items: center; gap: 0.125rem; padding: 0.25rem 0.375rem; border: 1px solid var(--ui-border); border-radius: var(--radius-panel); background: var(--ui-bg-muted); font-size: 0.65rem; font-weight: 700; }
.opponent-die { cursor: pointer; }
.opponent-die :deep(.die-icon) { width: 1.25rem; height: 1.25rem; color: var(--ui-error); }
.opponent-die:hover { border-color: var(--ui-error); }
.opponent-die:focus-visible { outline: 2px solid var(--ui-error); outline-offset: 2px; }
.opponent-die:disabled { opacity: 0.5; cursor: not-allowed; }
.dice-trigger { display: inline-flex; }
.dice-trigger button:disabled { pointer-events: none; }
.dice-trigger:focus-visible { outline: 2px solid var(--ui-error); outline-offset: 2px; border-radius: var(--radius-panel); }
.opponent-modifier input { width: 3rem; appearance: textfield; text-align: center; color: var(--ui-text-highlighted); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); background: var(--ui-bg); }
.opponent-modifier input::-webkit-inner-spin-button, .opponent-modifier input::-webkit-outer-spin-button { appearance: none; margin: 0; }
</style>
