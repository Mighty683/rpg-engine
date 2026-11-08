<script setup lang="ts">
defineProps<{ name: string; removed: boolean; pending?: boolean }>();
defineEmits<{ restore: []; remove: [] }>();
</script>

<template>
  <li class="flex flex-wrap items-center justify-between gap-small">
    <span
      >{{ name }}
      <UBadge color="neutral" variant="subtle">{{ removed ? "Removed" : "Active" }}</UBadge></span
    >
    <UButton
      v-if="removed"
      color="neutral"
      variant="outline"
      :disabled="pending"
      @click="$emit('restore')"
      >Restore access</UButton
    >
    <UButton v-else color="error" variant="outline" :disabled="pending" @click="$emit('remove')"
      >Remove access</UButton
    >
  </li>
</template>
