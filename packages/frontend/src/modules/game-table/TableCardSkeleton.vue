<script setup lang="ts">
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
</script>

<template>
  <div class="table-card space-y-card-gap rounded-panel border border-default p-card-padding">
    <SkeletonBlock class="h-5 w-2/3" />
    <div class="grid grid-cols-2 gap-card-gap">
      <SkeletonBlock v-for="bar in 2" :key="bar" class="h-5" />
    </div>
    <div class="grid grid-cols-4 gap-card-gap">
      <SkeletonBlock v-for="attribute in 4" :key="attribute" class="h-8" />
    </div>
    <SkeletonBlock class="h-6" />
  </div>
</template>
