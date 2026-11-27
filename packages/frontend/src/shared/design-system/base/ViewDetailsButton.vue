<script setup lang="ts">
import { tr } from "../../i18n";
defineProps<{ name: string }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <UTooltip :text="tr('ui.viewDetailsForValue1', { value1: name })">
    <UButton
      class="ml-auto cursor-pointer"
      color="neutral"
      variant="outline"
      size="sm"
      icon="i-lucide-info"
      :aria-label="tr('ui.viewDetailsForValue1', { value1: name })"
      data-testid="view-details"
      @click="emit('open')"
    />
  </UTooltip>
</template>
