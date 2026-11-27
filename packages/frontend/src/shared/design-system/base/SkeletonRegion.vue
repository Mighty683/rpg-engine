<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <div role="status">
    <span class="sr-only">{{ label }}</span>
    <slot />
  </div>
</template>
