<script setup lang="ts">
import type { Attribute, CheckDraft, CheckResult, DieSize } from "./types";

import { useTemplateRef } from "vue";
import { attributes, dieSizes } from "./model";

const props = defineProps<{ character?: string; result?: CheckResult; error?: string }>();
defineEmits<{ roll: []; cancel: [] }>();
const draft = defineModel<CheckDraft | undefined>({ required: true });
const heading = useTemplateRef<HTMLHeadingElement>("heading");
const dieOptions = dieSizes.map((value) => ({ label: `d${value}`, value }));

function update(changes: Partial<CheckDraft>) {
  if (draft.value) draft.value = { ...draft.value, ...changes };
}

function setDie(attribute: Attribute, size: DieSize) {
  if (draft.value) update({ dice: { ...draft.value.dice, [attribute]: size } });
}

function setNumber(field: "modifier" | "difficulty", value: string | number) {
  update({ [field]: value === "" ? undefined : Number(value) });
}

defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>
  <h2 ref="heading" tabindex="-1" class="text-section font-semibold">Check roller</h2>
  <form
    v-if="draft && props.character"
    class="space-y-medium"
    novalidate
    @submit.prevent="$emit('roll')"
  >
    <p>
      Rolling for <strong>{{ props.character }}</strong>
    </p>
    <div class="grid grid-cols-2 gap-small">
      <UFormField label="First attribute">
        <USelect
          :model-value="draft.first"
          :items="[...attributes]"
          class="w-full"
          @update:model-value="update({ first: $event })"
        />
      </UFormField>
      <UFormField label="First die">
        <USelect
          :model-value="draft.dice[draft.first]"
          :items="dieOptions"
          class="w-full"
          @update:model-value="setDie(draft.first, $event)"
        />
      </UFormField>
      <UFormField label="Second attribute">
        <USelect
          :model-value="draft.second"
          :items="[...attributes]"
          class="w-full"
          @update:model-value="update({ second: $event })"
        />
      </UFormField>
      <UFormField label="Second die">
        <USelect
          :model-value="draft.dice[draft.second]"
          :items="dieOptions"
          class="w-full"
          @update:model-value="setDie(draft.second, $event)"
        />
      </UFormField>
      <UFormField label="Modifier">
        <UInput
          :model-value="draft.modifier"
          type="number"
          step="1"
          class="w-full"
          @update:model-value="setNumber('modifier', $event)"
        />
      </UFormField>
      <UFormField label="Difficulty">
        <UInput
          :model-value="draft.difficulty"
          type="number"
          min="1"
          step="1"
          class="w-full"
          @update:model-value="setNumber('difficulty', $event)"
        />
      </UFormField>
    </div>
    <p v-if="props.error" role="alert" class="text-label text-error">{{ props.error }}</p>
    <div class="flex gap-small">
      <UButton type="submit">Roll</UButton>
      <UButton color="neutral" variant="outline" @click="$emit('cancel')">Cancel</UButton>
    </div>
  </form>
  <p v-else class="text-muted">Choose a character to roll a check.</p>
  <div role="status" class="space-y-tight">
    <template v-if="props.result">
      <h3 class="border-t border-default pt-medium font-semibold">
        Latest roll · {{ props.result.character }}
      </h3>
      <p class="text-label text-muted">
        {{ props.result.dice[0].attribute }} d{{ props.result.dice[0].size }}:
        {{ props.result.dice[0].face }} · {{ props.result.dice[1].attribute }} d{{
          props.result.dice[1].size
        }}: {{ props.result.dice[1].face }} · Modifier {{ props.result.modifier >= 0 ? "+" : ""
        }}{{ props.result.modifier }}
      </p>
      <p>
        <strong>{{ props.result.outcome }}</strong> · {{ props.result.total }} vs difficulty
        {{ props.result.difficulty }}
      </p>
      <p v-if="props.result.outcome === 'Critical success'" class="text-label text-muted">
        The character gains an opportunity.
      </p>
      <p v-if="props.result.outcome === 'Fumble'" class="text-label text-muted">
        The opposition gains an opportunity. Award 1 Fabula Point if the character is a player
        character.
      </p>
    </template>
  </div>
</template>
