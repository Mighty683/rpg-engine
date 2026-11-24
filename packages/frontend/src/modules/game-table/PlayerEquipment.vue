<script setup lang="ts">
import { computed } from "vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import { useGameCharacterQuery } from "../characters/hooks";
import type { Snapshot } from "../characters/types";

const props = defineProps<{ gameId: string; characterId: string }>();
const sheet = useGameCharacterQuery(props.gameId, props.characterId);
const items = computed(
  () =>
    (sheet.data.value as Snapshot | undefined)?.character.sheet.equipment.filter(
      (item) => item.kind !== "weapon",
    ) ?? [],
);
</script>

<template>
  <section aria-label="Equipment" class="space-y-small text-label" data-testid="player-equipment">
    <h3 class="font-semibold text-muted">Equipment</h3>
    <ContentState v-if="sheet.isPending.value" kind="loading">Loading equipment…</ContentState>
    <ContentState v-else-if="sheet.isError.value" kind="error" @retry="sheet.refetch()"
      >Could not load equipment.</ContentState
    >
    <ul v-else-if="items.length" class="grid gap-tight">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex flex-wrap items-center justify-between gap-x-small rounded-control bg-muted px-small py-tight"
      >
        <span>{{ item.name }}</span>
        <span class="text-muted"
          >{{ item.kind === "other" ? "Item" : item.kind === "armor" ? "Armor" : "Shield" }} ·
          {{ item.equipped ? "Equipped" : "Carried" }}</span
        >
      </li>
    </ul>
    <p v-else class="text-muted">No other equipment.</p>
  </section>
</template>
