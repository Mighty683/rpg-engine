<script setup lang="ts">
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";
import TableCardSkeleton from "../game-table/TableCardSkeleton.vue";
import CharacterSheetSkeleton from "../characters/sheet/CharacterSheetSkeleton.vue";
defineProps<{ settings: boolean; management: boolean; characterId: string }>();
</script>

<template>
  <div v-if="settings" class="space-y-section">
    <ScreenSection v-for="section in 2" :key="section" class="space-y-medium p-large">
      <SkeletonBlock class="h-6 w-28" /><SkeletonBlock class="h-9" />
    </ScreenSection>
  </div>
  <CharacterSheetSkeleton v-else-if="management && characterId" />
  <div v-else-if="management" class="space-y-section">
    <SkeletonBlock class="ml-auto h-8 w-32" />
    <div class="space-y-medium rounded-panel border border-default p-medium">
      <SkeletonBlock class="h-6 w-36" />
      <div class="grid gap-medium sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonBlock class="h-24" />
      </div>
    </div>
  </div>
  <ScreenSection v-else class="p-large"
    ><SkeletonBlock class="h-7 w-16" />
    <div
      class="party-grid table-cards-compact grid grid-cols-2 pt-small md:grid-cols-3 lg:grid-cols-4"
    >
      <TableCardSkeleton v-for="card in 2" :key="card" />
    </div>
  </ScreenSection>
</template>
