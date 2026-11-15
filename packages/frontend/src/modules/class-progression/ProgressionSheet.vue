<script setup lang="ts">
import { computed } from "vue";
import CharacterSheet from "../characters/sheet/CharacterSheet.vue";
import { toCharacter } from "../characters/sheet/model";
import CharacterAbilities from "./CharacterAbilities.vue";
import type { ProgressionClass, ProgressionCharacter } from "./types";
const props = defineProps<{
  character: ProgressionCharacter;
  catalog: ProgressionClass[];
  readOnly?: boolean;
  levels?: Record<string, number>;
  saving?: boolean;
}>();
defineEmits<{
  changeClass: [id: string, delta: number];
  changeSkill: [id: string, delta: number];
}>();
const sheetCharacter = computed(() => toCharacter(props.character.sheet, props.character.id, true));
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
