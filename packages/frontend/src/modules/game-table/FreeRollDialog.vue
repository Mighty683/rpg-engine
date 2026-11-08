<script setup lang="ts">
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
}>();
const emit = defineEmits<{
  submit: [];
  cancel: [];
  "update:opponent": [value: OpponentDraft];
  "update:character": [value: string];
}>();

const freeDice = [4, 6, 8, 10, 12, 20] as const;
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
        <DicePoolEditor
          v-model:dice="draft.dice"
          v-model:modifier="draft.modifier"
          :sizes="freeDice"
          :opposing-dice="opponent.dice"
          @remove-opposing="emit('update:opponent', { ...opponent, dice: opponent.dice.filter((_, index) => index !== $event) })"
        >
          <OpposedSetup :model-value="opponent" :sizes="freeDice" :show-pool="false" @update:model-value="emit('update:opponent', $event)" />
        </DicePoolEditor>
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
