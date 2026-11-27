<script setup lang="ts">
import { tr } from "../../shared/i18n";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
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
  <section
    :aria-label="tr('ui.equipment2')"
    class="space-y-small text-label"
    data-testid="player-equipment"
  >
    <h3 class="font-semibold text-muted">{{ tr("ui.equipment2") }}</h3>
    <SkeletonRegion
      v-if="sheet.isPending.value"
      :label="tr('ui.loadingEquipment')"
      class="grid gap-tight"
    >
      <SkeletonBlock v-for="row in 2" :key="row" class="h-5" />
    </SkeletonRegion>
    <ContentState v-else-if="sheet.isError.value" kind="error" @retry="sheet.refetch()">{{
      tr("ui.couldNotLoadEquipment")
    }}</ContentState>
    <ul v-else-if="items.length" class="grid gap-tight">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex flex-wrap items-center justify-between gap-x-small rounded-control bg-muted px-small py-tight"
      >
        <span>{{ item.name }}</span>
        <span class="text-muted"
          >{{
            item.kind === "other"
              ? tr("ui.item")
              : item.kind === "armor"
                ? tr("ui.armor")
                : tr("ui.shield")
          }}
          · {{ item.equipped ? tr("ui.equipped") : tr("ui.carried") }}</span
        >
      </li>
    </ul>
    <p v-else class="text-muted">{{ tr("ui.noOtherEquipment") }}</p>
  </section>
</template>
