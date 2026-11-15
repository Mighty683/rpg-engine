<script setup lang="ts">
import SegmentedProgress from "../../../src/shared/design-system/base/SegmentedProgress.vue";
</script>
<template>
  <Story title="Design system/Base/Segmented progress">
    <div class="max-w-md space-y-medium bg-default p-section text-default">
      <p>Class level · 3 of 10</p>
      <SegmentedProgress :value="3" :maximum="10" label="Class level" />
      <p>Skill rank · 2 of 5</p>
      <SegmentedProgress :value="2" :maximum="5" label="Skill rank" />
    </div>
  </Story>
</template>
