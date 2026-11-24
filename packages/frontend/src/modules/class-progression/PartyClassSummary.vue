<script setup lang="ts">
import { computed, ref } from "vue";
import type { PartyCharacter } from "../game-table/types";
import { useGameCharacterQuery } from "../characters/hooks";
import type { Snapshot } from "../characters/types";
import { useGameClassCatalogQuery } from "./hooks";
import { managedAbilities } from "./model";
import ClassLevelBars from "./ClassLevelBars.vue";
import TableClassesCard from "./TableClassesCard.vue";

const props = defineProps<{ gameId: string; member: PartyCharacter }>();
const emit = defineEmits<{ openSheet: [] }>();
const summary = computed(
  () => props.member.classSummary ?? props.member.classes.map((name) => ({ name, level: null })),
);
const requested = ref(false);
const enabled = computed(() => requested.value && props.member.canRoll);
const sheet = useGameCharacterQuery(props.gameId, props.member.id, enabled);
const catalog = useGameClassCatalogQuery(props.gameId, enabled);
const savedCharacter = computed(() => (sheet.data.value as Snapshot | undefined)?.character);
const abilities = computed(() => {
  const progression = savedCharacter.value?.progression;
  return progression && managedAbilities(progression);
});
function retry() {
  void Promise.all([sheet.refetch(), catalog.refetch()]);
}
</script>

<template>
  <TableClassesCard
    v-if="member.canRoll"
    :id="member.id"
    :name="member.name"
    :summary="summary"
    :character="abilities"
    :catalog="catalog.data.value ?? []"
    :loading="sheet.isLoading.value || catalog.isLoading.value"
    :failed="sheet.isError.value || catalog.isError.value"
    :can-add-class="savedCharacter?.canEdit"
    @open-sheet="emit('openSheet')"
    @inspect="requested = true"
    @retry="retry"
  />
  <ClassLevelBars v-else :entries="summary" />
</template>
