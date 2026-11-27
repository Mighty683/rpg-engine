<script setup lang="ts">
import SurfaceCard from "../../shared/design-system/base/SurfaceCard.vue";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
</script>

<template>
  <SurfaceCard compact>
    <div class="space-y-small">
      <SkeletonBlock class="h-5 w-1/3" />
      <SkeletonBlock class="w-2/3 text-xs" />
      <SkeletonBlock class="w-4/5" />
    </div>
  </SurfaceCard>
</template>
