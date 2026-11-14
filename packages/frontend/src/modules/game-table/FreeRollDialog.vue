<script setup lang="ts">
import LabeledSelect from "../../shared/design-system/base/LabeledSelect.vue";
import FormActions from "../../shared/design-system/base/FormActions.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import type { FreeDraft, OpponentDraft } from "./types";
import DicePoolEditor from "./DicePoolEditor.vue";
import OpposedSetup from "./OpposedSetup.vue";

defineProps<{
  draft: FreeDraft;
  opponent: OpponentDraft;
  role: "GM" | "Player";
  rollAsOptions: { label: string; value: string }[];
  playerActiveName: string;
  playerHasActive: boolean;
  error: string;
  pending: boolean;
  privateRoll: boolean;
}>();
const emit = defineEmits<{
  submit: [];
  cancel: [];
  "update:privateRoll": [value: boolean];
  "update:opponent": [value: OpponentDraft];
  "update:character": [value: string];
}>();

const freeDice = [4, 6, 8, 10, 12, 20] as const;
</script>

<template>
  <UModal
    :open="true"
    :close="!pending"
    :dismissible="!pending"
    title="Make a roll"
    description="Choose dice and an optional modifier."
    @update:open="
      (open: boolean) => {
        if (!open && !pending) emit('cancel');
      }
    "
  >
    <template #body>
      <form class="space-y-medium" data-testid="free-roll-dialog" @submit.prevent="emit('submit')">
        <fieldset :disabled="pending" class="space-y-medium">
          <LabeledSelect
            v-if="role === 'GM'"
            label="Roll as"
            :model-value="draft.characterId"
            :items="rollAsOptions"
            class="w-full"
            data-testid="roll-as"
            @update:model-value="emit('update:character', String($event))"
          >
            <template #item-label="{ item }">
              <span :data-testid="`roll-as-option-${item.value === 'gm' ? 'gm' : 'character'}`">{{
                item.label
              }}</span>
            </template>
          </LabeledSelect>
          <p v-else class="text-sm text-muted" data-testid="player-roll-as">
            <template v-if="playerHasActive">Rolling as {{ playerActiveName }}.</template>
            <template v-else
              >Select an active character in character management before rolling.</template
            >
          </p>
          <DicePoolEditor
            v-model:dice="draft.dice"
            v-model:modifier="draft.modifier"
            :sizes="freeDice"
            :opposing-dice="opponent.dice"
            @remove-opposing="
              emit('update:opponent', {
                ...opponent,
                dice: opponent.dice.filter((_, index) => index !== $event),
              })
            "
          >
            <OpposedSetup
              :model-value="opponent"
              :sizes="freeDice"
              :show-pool="false"
              @update:model-value="emit('update:opponent', $event)"
            />
          </DicePoolEditor>
          <LabeledInput label="Note" hint="Optional" v-model="draft.note" data-testid="free-note" />
          <UCheckbox
            :model-value="privateRoll"
            label="Private roll"
            description="Only you can see this roll, including the result and note."
            :disabled="pending"
            data-testid="private-roll"
            @update:model-value="emit('update:privateRoll', $event === true)"
          />
          <p v-if="error" role="alert" class="text-error" data-testid="free-error">{{ error }}</p>
          <FormActions
            submit-label="Roll"
            :pending="pending"
            :blocked="role === 'Player' && !playerHasActive"
            submit-test-id="submit-free-roll"
            cancel-test-id="cancel-free-roll"
            @cancel="emit('cancel')"
          />
        </fieldset>
      </form>
    </template>
  </UModal>
</template>
