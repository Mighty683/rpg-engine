<script setup lang="ts">
import { computed } from "vue";
import CharacterSheet from "../characters/sheet/CharacterSheet.vue";
import CharacterLevelField from "../characters/sheet/identity/CharacterLevelField.vue";
import { toCharacter } from "../characters/sheet/model";
import ExperienceFields from "./ExperienceFields.vue";
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
      <ExperienceFields
        :experience="character.experience"
        :read-only="readOnly"
        :disabled="saving"
        @change="(field, value) => emit('changeExperience', field, value)"
      />
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
