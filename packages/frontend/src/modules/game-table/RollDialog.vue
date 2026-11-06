<script setup lang="ts">
import { computed } from "vue";
import type { Attribute, PartyCharacter } from "./contract";
import DieIcon from "../../shared/design-system/DieIcon.vue";
import OpposedSetup, { type OpponentDraft } from "./OpposedSetup.vue";

export type RollDraft = {
  mode: "attribute" | "weapon";
  character: PartyCharacter;
  weaponId: string | null;
  weaponName: string;
  weaponBonus: number;
  first: Attribute;
  second: Attribute | null;
  dice: Record<Attribute, number>;
  modifier: string;
  note: string;
};

const props = defineProps<{
  draft: RollDraft;
  opponent: OpponentDraft;
  error: string;
  pending: boolean;
}>();
const emit = defineEmits<{
  submit: [];
  cancel: [];
  "update:opponent": [value: OpponentDraft];
}>();

const attributes: readonly Attribute[] = ["DEX", "INS", "MIG", "WLP"];
const dieSizes = [6, 8, 10, 12] as const;
const title = computed(() => `${props.draft.character.name} · ${props.draft.mode === "attribute" ? "Attribute check" : props.draft.weaponName}`);
const usedAttributes = computed(() => [props.draft.first, props.draft.second].filter((value): value is Attribute => value !== null));
function toggleSecond(attribute: Attribute) {
  props.draft.second = props.draft.second === attribute ? null : attribute;
}
</script>

<template>
  <UModal :open="true" :title="title" @update:open="(open: boolean) => { if (!open) emit('cancel') }">
    <template #description>Adjust dice for temporary effects. These choices only apply to this roll.</template>
    <template #body>
      <form class="space-y-medium" data-testid="roll-dialog" @submit.prevent="emit('submit')">
        <div class="space-y-small">
          <template v-for="(attribute, index) in usedAttributes" :key="`${attribute}-${index}`">
            <div class="flex flex-wrap items-end gap-medium">
              <fieldset>
                <legend class="mb-small text-sm font-medium">{{ attribute }} die<span v-if="index === 1 && attribute === draft.first"> (same size as first)</span></legend>
                <div class="flex flex-wrap gap-small">
                  <label v-for="size in dieSizes" :key="size" class="die-choice">
                    <input v-model="draft.dice[attribute]" class="sr-only" type="radio" :name="`die-${index}-${attribute}`" :value="size" :data-testid="index === 1 && attribute === draft.first ? `second-die-size-${attribute}-${size}` : `die-size-${attribute}-${size}`" />
                    <span class="die-choice-content"><DieIcon :sides="size" /><span>d{{ size }}</span></span>
                  </label>
                </div>
              </fieldset>
              <UFormField v-if="index === 0" label="Check modifier" class="w-28">
                <UInput v-model="draft.modifier" type="number" step="1" class="w-full" data-testid="check-modifier" />
              </UFormField>
            </div>
            <fieldset v-if="index === 0 && draft.mode === 'attribute'">
              <legend class="mb-small text-sm font-medium">Second attribute <span class="text-muted">(optional)</span></legend>
              <div class="flex flex-wrap gap-small">
                <button
                  v-for="choice in attributes"
                  :key="choice"
                  type="button"
                  class="attribute-choice die-choice-content"
                  :data-testid="`second-attribute-${choice}`"
                  :aria-pressed="draft.second === choice"
                  @click="toggleSecond(choice)"
                >
                  {{ choice }}
                </button>
              </div>
            </fieldset>
          </template>
        </div>
        <p v-if="draft.mode === 'weapon'">Weapon accuracy bonus: <strong data-testid="weapon-bonus">{{ draft.weaponBonus >= 0 ? '+' : '' }}{{ draft.weaponBonus }}</strong></p>
        <OpposedSetup v-if="draft.mode === 'attribute'" :model-value="opponent" @update:model-value="emit('update:opponent', $event)" />
        <UFormField label="Note" hint="Optional"><UInput v-model="draft.note" class="w-full" data-testid="roll-note" /></UFormField>
        <p v-if="error" role="alert" class="text-error" data-testid="roll-error">{{ error }}</p>
        <div class="flex justify-end gap-small">
          <UButton type="button" color="neutral" variant="outline" data-testid="cancel-roll" @click="emit('cancel')">Cancel</UButton>
          <UButton type="submit" :loading="pending" :disabled="pending" data-testid="submit-roll">Roll</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<style scoped>
.die-choice { cursor: pointer; }
.die-choice-content { display: flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.5rem; border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); background: var(--ui-bg); font-size: 0.875rem; }
.die-choice-content :deep(.die-icon) { width: 1.25rem; height: 1.25rem; }
.die-choice input:checked + .die-choice-content { border-color: var(--ui-primary); background: var(--ui-bg-elevated); }
.die-choice input:focus-visible + .die-choice-content { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.attribute-choice[aria-pressed="true"] { border-color: var(--ui-primary); background: var(--ui-bg-elevated); }
.attribute-choice:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
</style>
