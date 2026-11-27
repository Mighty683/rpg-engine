<script setup lang="ts">
import SkeletonBlock from "../../../shared/design-system/base/SkeletonBlock.vue";
import ScreenSection from "../../../shared/design-system/base/ScreenSection.vue";
</script>

<template>
  <div class="sheet space-y-small rounded-panel border border-default p-medium">
    <div class="sheet-header border-b border-default pb-small">
      <SkeletonBlock class="h-12" />
      <SkeletonBlock class="h-12" />
      <SkeletonBlock class="h-12 w-20" />
      <SkeletonBlock class="h-12 w-24" />
      <div class="vital-resources">
        <SkeletonBlock class="h-10" /><SkeletonBlock class="h-10" />
      </div>
    </div>
    <ScreenSection class="sheet-split attributes-resources">
      <div class="grid grid-cols-4 gap-small">
        <SkeletonBlock v-for="die in 4" :key="die" class="h-16" />
      </div>
      <SkeletonBlock class="h-16" />
    </ScreenSection>
    <ScreenSection v-for="section in 3" :key="section" class="space-y-small">
      <SkeletonBlock class="h-5 w-1/4" />
      <div class="grid grid-cols-2 gap-small sm:grid-cols-4">
        <SkeletonBlock v-for="field in 4" :key="field" class="h-12" />
      </div>
    </ScreenSection>
  </div>
</template>

<style scoped src="./sheet-layout.css"></style>
