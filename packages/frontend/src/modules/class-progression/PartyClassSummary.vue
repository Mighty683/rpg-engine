<script setup lang="ts">
import { computed, ref } from "vue";
import type { PartyCharacter } from "../game-table/types";
import { useGameCharacterQuery } from "../characters/hooks";
import type { Snapshot } from "../characters/types";
import { useGameClassCatalogQuery } from "./hooks";
import { managedAbilities } from "./model";
import TableClassesCard from "./TableClassesCard.vue";

const props = defineProps<{ gameId: string; member: PartyCharacter }>();
const requested = ref(false);
const enabled = computed(() => requested.value && props.member.canRoll);
const sheet = useGameCharacterQuery(props.gameId, props.member.id, enabled);
const catalog = useGameClassCatalogQuery(props.gameId, enabled);
const abilities = computed(() => {
  const progression = (sheet.data.value as Snapshot | undefined)?.character.progression;
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
    :summary="member.classes"
    :character="abilities"
    :catalog="catalog.data.value ?? []"
    :loading="sheet.isLoading.value || catalog.isLoading.value"
    :failed="sheet.isError.value || catalog.isError.value"
    @inspect="requested = true"
    @retry="retry"
  />
  <div v-else class="rounded-control bg-elevated px-medium py-small">
    <p class="text-small text-muted">Classes</p>
    <p>{{ member.classes.join(" · ") || "No classes selected" }}</p>
  </div>
</template>
