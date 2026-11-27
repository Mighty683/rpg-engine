<script setup lang="ts">
import { tr } from "../../shared/i18n";
defineProps<{ name: string; removed: boolean; pending?: boolean }>();
defineEmits<{ restore: []; remove: [] }>();
</script>

<template>
  <li class="flex flex-wrap items-center justify-between gap-small">
    <span
      >{{ name }}
      <UBadge color="neutral" variant="subtle">{{
        removed ? tr("ui.removed") : tr("ui.active")
      }}</UBadge></span
    >
    <UButton
      v-if="removed"
      color="neutral"
      variant="outline"
      :disabled="pending"
      @click="$emit('restore')"
      >{{ tr("ui.restoreAccess") }}</UButton
    >
    <UButton v-else color="error" variant="outline" :disabled="pending" @click="$emit('remove')">{{
      tr("ui.removeAccess")
    }}</UButton>
  </li>
</template>
