<script setup lang="ts">
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
</script>

<template>
  <div class="space-y-medium">
    <div class="space-y-small"><SkeletonBlock class="w-12" /><SkeletonBlock class="h-8" /></div>
    <div class="space-y-small">
      <SkeletonBlock class="w-16" />
      <div class="rounded-panel border border-default">
        <SkeletonBlock class="h-9 w-2/3" /><SkeletonBlock class="h-36" />
      </div>
    </div>
  </div>
</template>
