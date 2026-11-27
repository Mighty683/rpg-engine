<script setup lang="ts">
import { tr } from "../../shared/i18n";
import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
defineProps<{ expanded?: boolean }>();
</script>

<template>
  <SkeletonRegion :label="tr('ui.loadingClasses')">
    <ScreenSection class="space-y-small">
      <SkeletonBlock class="h-5 w-20" />
      <div class="space-y-small rounded-panel border border-default p-small">
        <SkeletonBlock class="h-5 w-1/3" /><SkeletonBlock class="h-3" />
        <SkeletonBlock v-if="expanded" class="h-16" />
      </div>
    </ScreenSection>
  </SkeletonRegion>
</template>
