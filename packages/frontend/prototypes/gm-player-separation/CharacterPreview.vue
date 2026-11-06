<script setup lang="ts">
import { computed } from "vue";
import CharacterSheet from "../../src/modules/characters/sheet/CharacterSheet.vue";
import { useSheetCalculations } from "./useSheetCalculations";
import type { CharacterView, Resource } from "./model";

const props = defineProps<{ character: CharacterView }>();
const emit = defineEmits<{ overrideMaximum: [resource: Resource, value: number | null] }>();
const sheet = computed(() => props.character.sheet);
const { maximum, baseDefense, defenseDetails } = useSheetCalculations(sheet);
const displayedMaximum = computed(() => ({
  HP: props.character.maximumOverrides.HP ?? maximum.value.HP,
  MP: props.character.maximumOverrides.MP ?? maximum.value.MP,
  IP: props.character.maximumOverrides.IP ?? maximum.value.IP,
}));
</script>

<template>
  <div class="space-y-small">
    <UBadge v-if="!character.editable" color="neutral" variant="subtle">Read-only</UBadge>
    <CharacterSheet
      :character="sheet"
      :read-only="!character.editable"
      :maximum="displayedMaximum"
      :maximum-overrides="character.maximumOverrides"
      :base-defense="baseDefense"
      :defense-details="defenseDetails"
      @override-maximum="(resource, value) => emit('overrideMaximum', resource, value)"
    />
  </div>
</template>
