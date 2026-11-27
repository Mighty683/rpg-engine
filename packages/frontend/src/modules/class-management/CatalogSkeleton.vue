<script setup lang="ts">
import { tr } from "../../shared/i18n";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import SurfaceCard from "../../shared/design-system/base/SurfaceCard.vue";
defineProps<{ screen: string; useBreadcrumbs?: boolean }>();
</script>

<template>
  <SkeletonRegion :label="tr('ui.loadingClasses')" :class="{ 'p-section': !useBreadcrumbs }">
    <div
      class="mx-auto flex flex-col gap-section"
      :class="useBreadcrumbs ? 'max-w-6xl' : 'max-w-5xl'"
    >
      <div class="flex justify-between gap-medium">
        <div class="space-y-tight">
          <SkeletonBlock class="h-4 w-24" /><SkeletonBlock class="h-9 w-40" />
        </div>
        <SkeletonBlock class="h-8 w-24" />
      </div>
      <template v-if="screen === 'List' || screen === 'Copy'">
        <SkeletonBlock v-if="screen === 'Copy'" class="h-6 w-2/3" />
        <SurfaceCard v-for="row in 2" :key="row"
          ><div class="flex items-center justify-between">
            <div class="space-y-small">
              <SkeletonBlock class="h-6 w-28" /><SkeletonBlock class="h-4 w-36" />
            </div>
            <SkeletonBlock class="h-8 w-16" /></div
        ></SurfaceCard>
      </template>
      <div v-else-if="screen === 'Create'" class="flex flex-wrap items-end gap-small">
        <div class="space-y-small">
          <SkeletonBlock class="w-20" /><SkeletonBlock class="h-8 w-44" />
        </div>
        <SkeletonBlock class="h-8 w-24" />
      </div>
      <SkeletonBlock v-if="screen === 'Details'" class="h-9" />
      <SurfaceCard v-if="screen === 'Details'" class="space-y-medium"
        ><SkeletonBlock class="w-16" /><SkeletonBlock class="h-9" /><SkeletonBlock
          class="w-24" /><SkeletonBlock class="h-20"
      /></SurfaceCard>
    </div>
  </SkeletonRegion>
</template>
