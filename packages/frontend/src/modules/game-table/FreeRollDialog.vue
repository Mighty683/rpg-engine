<script setup lang="ts">
import { computed } from "vue";
import DieIcon from "../../shared/design-system/DieIcon.vue";
import OpposedSetup, { type OpponentDraft } from "./OpposedSetup.vue";

export type FreeDraft = {
  characterId: string;
  dice: number[];
  modifier: string;
  note: string;
};

const props = defineProps<{
  draft: FreeDraft;
  opponent: OpponentDraft;
  role: "GM" | "Player";
  rollAsOptions: { label: string; value: string }[];
  playerActiveName: string;
  playerHasActive: boolean;
  error: string;
  pending: boolean;
}>();
const emit = defineEmits<{
  submit: [];
  cancel: [];
  "update:opponent": [value: OpponentDraft];
  "update:character": [value: string];
}>();

const freeDice = [4, 6, 8, 10, 12, 20] as const;
const poolFull = computed(() => props.draft.dice.length >= 2);

function addDie(size: number) {
  if (props.draft.dice.length < 2) props.draft.dice.push(size);
}
function removeDie(index: number) {
  props.draft.dice.splice(index, 1);
}
</script>

<template>
  <UModal :open="true" title="Make a roll" description="Choose dice and an optional modifier." @update:open="(open: boolean) => { if (!open) emit('cancel') }">
    <template #body>
      <form class="space-y-medium" data-testid="free-roll-dialog" @submit.prevent="emit('submit')">
        <UFormField v-if="role === 'GM'" label="Roll as">
          <USelect
            :model-value="draft.characterId"
            :items="rollAsOptions"
            class="w-full"
            data-testid="roll-as"
            @update:model-value="emit('update:character', String($event))"
          >
            <template #item-label="{ item }">
              <span :data-testid="`roll-as-option-${item.value === 'gm' ? 'gm' : 'character'}`">{{ item.label }}</span>
            </template>
          </USelect>
        </UFormField>
        <p v-else class="text-sm text-muted" data-testid="player-roll-as">
          <template v-if="playerHasActive">Rolling as {{ playerActiveName }}.</template>
          <template v-else>Select an active character in character management before rolling.</template>
        </p>
        <p class="text-sm font-medium">Friendly dice</p>
        <div class="flex flex-wrap items-center gap-small" aria-label="Add dice and modifier">
          <UTooltip
            v-for="size in freeDice"
            :key="size"
            :disabled="!poolFull"
            text="Maximum 2 dice"
            :content="{ side: 'top' }"
          >
            <span class="dice-trigger" :tabindex="poolFull ? 0 : undefined">
              <button
                type="button"
                class="free-die-button"
                :data-testid="`add-die-d${size}`"
                :aria-label="`Add d${size} to dice pool`"
                :disabled="poolFull"
                @click="addDie(size)"
              >
                <DieIcon :sides="size" /><span>d{{ size }}</span>
              </button>
            </span>
          </UTooltip>
          <label class="modifier-card"><span>Modifier</span><input v-model="draft.modifier" type="number" step="1" data-testid="free-modifier" /></label>
        </div>
        <OpposedSetup :model-value="opponent" :sizes="freeDice" :show-pool="false" @update:model-value="emit('update:opponent', $event)" />
        <div>
          <p class="mb-small text-sm font-medium">Dice pool</p>
          <div v-if="draft.dice.length || opponent.dice.length" class="flex flex-wrap gap-small">
            <button
              v-for="(size, index) in draft.dice"
              :key="`friendly-${index}`"
              type="button"
              class="free-die-button"
              :data-testid="`pool-die-d${size}`"
              :aria-label="`Remove d${size} from dice pool`"
              @click="removeDie(index)"
            >
              <DieIcon :sides="size" /><span>d{{ size }}</span>
            </button>
            <button
              v-for="(size, index) in opponent.dice"
              :key="`opponent-${index}`"
              type="button"
              class="free-die-button opposing-pool-die"
              :data-testid="`opponent-pool-d${size}`"
              :aria-label="`Remove opposing d${size} from dice pool`"
              @click="opponent.dice.splice(index, 1)"
            >
              <DieIcon :sides="size" /><span>d{{ size }}</span>
            </button>
          </div>
          <p v-else class="text-sm text-muted" data-testid="pool-empty">Select dice to add them to the pool.</p>
        </div>
        <UFormField label="Note" hint="Optional"><UInput v-model="draft.note" class="w-full" data-testid="free-note" /></UFormField>
        <p v-if="error" role="alert" class="text-error" data-testid="free-error">{{ error }}</p>
        <div class="flex justify-end gap-small">
          <UButton type="button" color="neutral" variant="outline" data-testid="cancel-free-roll" @click="emit('cancel')">Cancel</UButton>
          <UButton type="submit" :loading="pending" :disabled="pending || (role === 'Player' && !playerHasActive)" data-testid="submit-free-roll">Roll</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<style scoped>
.free-die-button { min-width: 2.75rem; display: grid; justify-items: center; gap: 0.125rem; padding: 0.25rem 0.375rem; border: 1px solid var(--ui-border); border-radius: var(--radius-panel); background: var(--ui-bg-muted); font-size: 0.65rem; font-weight: 700; cursor: pointer; }
.free-die-button :deep(.die-icon) { width: 1.25rem; height: 1.25rem; }
.opposing-pool-die :deep(.die-icon) { color: var(--ui-error); }
.free-die-button:hover:not(:disabled) { border-color: var(--ui-primary); }
.free-die-button:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.free-die-button:disabled { opacity: 0.5; cursor: not-allowed; }
.dice-trigger { display: inline-flex; }
.dice-trigger button:disabled { pointer-events: none; }
.dice-trigger:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; border-radius: var(--radius-panel); }
.modifier-card { min-height: 2.75rem; display: grid; align-content: center; justify-items: center; gap: 0.125rem; padding: 0.25rem 0.375rem; border: 1px solid var(--ui-border); border-radius: var(--radius-panel); background: var(--ui-bg-muted); font-size: 0.65rem; font-weight: 700; }
.modifier-card input { width: 3rem; min-width: 0; appearance: textfield; text-align: center; color: var(--ui-text-highlighted); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); background: var(--ui-bg); }
.modifier-card input::-webkit-inner-spin-button, .modifier-card input::-webkit-outer-spin-button { appearance: none; margin: 0; }
</style>
