<script setup lang="ts">
defineProps<{ name: string }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <UTooltip :text="`View details for ${name}`">
    <UButton
      class="ml-auto cursor-pointer"
      color="neutral"
      variant="outline"
      size="sm"
      icon="i-lucide-info"
      :aria-label="`View details for ${name}`"
      data-testid="view-details"
      @click="emit('open')"
    />
  </UTooltip>
</template>
