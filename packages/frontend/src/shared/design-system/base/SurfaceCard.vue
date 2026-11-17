<script setup lang="ts">
defineProps<{ compact?: boolean }>();
</script>

<template>
  <section
    class="rounded-panel border border-default bg-elevated"
    :class="compact ? 'p-small' : 'p-section'"
  >
    <slot />
  </section>
</template>
