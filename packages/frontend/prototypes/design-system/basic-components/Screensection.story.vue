<script setup lang="ts">
import ScreenSection from "../../../src/shared/design-system/base/ScreenSection.vue";
</script>
<template>
  <Story title="Design system/Base/Screen section">
    <template #default>
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <ScreenSection class="p-large"
            ><h2 class="text-section font-semibold">Section heading</h2>
            <p>Section content.</p></ScreenSection
          >
        </div></UApp
      >
    </template>
  </Story>
</template>
