<script setup lang="ts">
import FormActions from "../../shared/design-system/base/FormActions.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import type { RollDraft, Attribute, OpponentDraft } from "./types";

import { computed } from "vue";

import DieIcon from "../../shared/design-system/domain/DieIcon.vue";
import OpposedSetup from "./OpposedSetup.vue";

const props = defineProps<{
  draft: RollDraft;
  opponent: OpponentDraft;
  error: string;
  pending: boolean;
  privateRoll: boolean;
}>();
const emit = defineEmits<{
  submit: [];
  cancel: [];
  "update:privateRoll": [value: boolean];
  "update:opponent": [value: OpponentDraft];
}>();

const attributes: readonly Attribute[] = ["DEX", "INS", "MIG", "WLP"];
const dieSizes = [6, 8, 10, 12] as const;
const title = computed(
  () =>
    `${props.draft.character.name} · ${props.draft.mode === "attribute" ? "Attribute check" : props.draft.weaponName}`,
);
const usedAttributes = computed(() =>
  [props.draft.first, props.draft.second].filter((value): value is Attribute => value !== null),
);
function toggleSecond(attribute: Attribute) {
  const previous = props.draft.second;
  if (previous && previous !== props.draft.first) {
    props.draft.dice[previous] = props.draft.character.baseDice[previous];
  }
  props.draft.second = props.draft.second === attribute ? null : attribute;
}
</script>

<template>
  <UModal
    :open="true"
    :close="!pending"
    :dismissible="!pending"
    :title="title"
    @update:open="
      (open: boolean) => {
        if (!open && !pending) emit('cancel');
      }
    "
  >
    <template #description
      >Adjust dice for temporary effects. These choices only apply to this roll.</template
    >
    <template #body>
      <form class="space-y-medium" data-testid="roll-dialog" @submit.prevent="emit('submit')">
        <fieldset :disabled="pending" class="space-y-medium">
          <div class="space-y-small">
            <template v-for="(attribute, index) in usedAttributes" :key="`${attribute}-${index}`">
              <div class="flex flex-wrap items-end gap-medium">
                <fieldset>
                  <legend :class="index === 0 ? 'mb-small text-small font-medium' : 'sr-only'">
                    {{ attribute }} die<span v-if="index === 1 && attribute === draft.first">
                      (same size as first)</span
                    >
                  </legend>
                  <div class="flex flex-wrap gap-small">
                    <label v-for="size in dieSizes" :key="size" class="die-choice">
                      <input
                        v-model="draft.dice[attribute]"
                        class="sr-only"
                        type="radio"
                        :name="`die-${index}-${attribute}`"
                        :value="size"
                        :data-testid="
                          index === 1 && attribute === draft.first
                            ? `second-die-size-${attribute}-${size}`
                            : `die-size-${attribute}-${size}`
                        "
                      />
                      <span class="die-tile"
                        ><DieIcon :sides="size" /><span>d{{ size }}</span></span
                      >
                    </label>
                  </div>
                </fieldset>
                <label v-if="index === 0" class="modifier-card">
                  <span>Check modifier</span>
                  <input
                    v-model="draft.modifier"
                    type="number"
                    step="1"
                    data-testid="check-modifier"
                  />
                </label>
              </div>
              <fieldset v-if="index === 0 && draft.mode === 'attribute'">
                <legend class="mb-small text-small font-medium">
                  Second attribute <span class="text-muted">(optional)</span>
                </legend>
                <div class="flex flex-wrap gap-small">
                  <button
                    v-for="choice in attributes"
                    :key="choice"
                    type="button"
                    class="attribute-choice die-tile"
                    :data-testid="`second-attribute-${choice}`"
                    :aria-pressed="draft.second === choice"
                    @click="toggleSecond(choice)"
                  >
                    <DieIcon :sides="draft.character.baseDice[choice]" /> {{ choice }}
                  </button>
                </div>
              </fieldset>
            </template>
          </div>
          <p v-if="draft.mode === 'weapon'">
            Weapon accuracy bonus:
            <strong data-testid="weapon-bonus"
              >{{ draft.weaponBonus >= 0 ? "+" : "" }}{{ draft.weaponBonus }}</strong
            >
          </p>
          <OpposedSetup
            v-if="draft.mode === 'attribute'"
            :model-value="opponent"
            :friendly-dice="usedAttributes.map((attribute) => draft.dice[attribute])"
            @update:model-value="emit('update:opponent', $event)"
          />
          <LabeledInput label="Note" hint="Optional" v-model="draft.note" data-testid="roll-note" />
          <UCheckbox
            :model-value="privateRoll"
            label="Private roll"
            description="Only you can see this roll, including the result and note."
            :disabled="pending"
            data-testid="private-roll"
            @update:model-value="emit('update:privateRoll', $event === true)"
          />
          <p v-if="error" role="alert" class="text-error" data-testid="roll-error">{{ error }}</p>
          <FormActions
            submit-label="Roll"
            :pending="pending"
            submit-test-id="submit-roll"
            cancel-test-id="cancel-roll"
            @cancel="emit('cancel')"
          />
        </fieldset>
      </form>
    </template>
  </UModal>
</template>

<style scoped>
.die-choice {
  cursor: pointer;
}
.modifier-card {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--dice-control-gap);
  padding: var(--dice-control-padding);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  font-size: var(--dice-label-size);
  font-weight: 700;
}
.modifier-card input {
  width: 3rem;
  appearance: textfield;
  text-align: center;
  color: var(--ui-text-highlighted);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-control);
  background: var(--ui-bg);
}
.modifier-card input::-webkit-inner-spin-button,
.modifier-card input::-webkit-outer-spin-button {
  appearance: none;
  margin: 0;
}
.die-choice input:checked + .die-tile {
  border-color: var(--ui-primary);
  background: var(--ui-bg-elevated);
}
.die-choice input:focus-visible + .die-tile {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
.attribute-choice[aria-pressed="true"] {
  border-color: var(--ui-primary);
  background: var(--ui-bg-elevated);
}
.attribute-choice:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
</style>
