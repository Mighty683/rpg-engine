<script setup lang="ts">
import { computed } from "vue";
import CharacterSheet from "../characters/sheet/CharacterSheet.vue";
import CharacterLevelField from "../characters/sheet/identity/CharacterLevelField.vue";
import { toCharacter } from "../characters/sheet/model";
import CharacterAbilities from "./CharacterAbilities.vue";
import type { ProgressionClass, ProgressionCharacter, ProgressionExperience } from "./types";
const props = defineProps<{
  character: ProgressionCharacter;
  catalog: ProgressionClass[];
  readOnly?: boolean;
  levels?: Record<string, number>;
  saving?: boolean;
}>();
const emit = defineEmits<{
  changeClass: [id: string, delta: number];
  changeSkill: [id: string, delta: number];
  changeExperience: [field: keyof ProgressionExperience, value: number];
  changeLevel: [level: number];
}>();
const sheetCharacter = computed(() => toCharacter(props.character.sheet, props.character.id, true));
function changeExperience(field: keyof ProgressionExperience, event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.valueAsNumber;
  input.value = String(props.character.experience[field]);
  emit("changeExperience", field, value);
}
function changeLevel(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.valueAsNumber;
  input.value = String(props.character.sheet.level);
  emit("changeLevel", value);
}
</script>
<template>
  <CharacterSheet
    :character="sheetCharacter"
    :current-dice="character.party.currentDice"
    read-only
    :hide-read-only-badge="!readOnly"
    :maximum="{
      HP: character.party.maxima.hp,
      MP: character.party.maxima.mp,
      IP: character.party.maxima.ip,
    }"
    :maximum-overrides="{ HP: null, MP: null, IP: null }"
    :base-defense="{
      DEF: character.party.defense ?? null,
      'MAG DEF': character.party.magicDefense ?? null,
      INIT: null,
    }"
    :defense-details="{ DEF: [], 'MAG DEF': [], INIT: [] }"
  >
    <template #level>
      <CharacterLevelField
        :level="character.sheet.level"
        :disabled="readOnly || saving"
        test-id="progression-character-level"
        @change="changeLevel"
      />
    </template>
    <template #experience>
      <div class="self-center" role="group" aria-label="Experience">
        <p class="text-label text-muted">EXP</p>
        <p v-if="readOnly">{{ character.experience.current }} / {{ character.experience.total }}</p>
        <div v-else class="flex items-center gap-small">
          <UInput
            :model-value="character.experience.current"
            type="number"
            min="0"
            size="sm"
            class="w-18"
            :disabled="saving"
            aria-label="Current EXP"
            data-testid="current-exp"
            @change="changeExperience('current', $event)"
          />
          <span aria-hidden="true">/</span>
          <UInput
            :model-value="character.experience.total"
            type="number"
            min="0"
            size="sm"
            class="w-18"
            :disabled="saving"
            aria-label="Total EXP"
            data-testid="total-exp"
            @change="changeExperience('total', $event)"
          />
        </div>
      </div>
    </template>
    <template #class-progression
      ><CharacterAbilities
        :catalog="catalog"
        :character="character"
        :read-only="readOnly"
        :levels="levels"
        :saving="saving"
        @change-class="(id, delta) => $emit('changeClass', id, delta)"
        @change-skill="(id, delta) => $emit('changeSkill', id, delta)"
    /></template>
  </CharacterSheet>
</template>
