<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    confirmLabel: string;
    cancelLabel?: string;
    destructive?: boolean;
    pending?: boolean;
    confirmTestId?: string;
    cancelTestId?: string;
    close?: boolean;
  }>(),
  { cancelLabel: "Cancel", close: true },
);
defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="description"
    :close="close"
    @update:open="
      (value: boolean) => {
        if (!value && !pending) $emit('cancel');
      }
    "
  >
    <template #body>
      <div class="space-y-medium">
        <slot />
        <div class="flex flex-wrap justify-end gap-small">
          <UButton
            color="neutral"
            variant="outline"
            :disabled="pending"
            :data-testid="cancelTestId"
            @click="$emit('cancel')"
            >{{ cancelLabel }}</UButton
          >
          <UButton
            :color="destructive ? 'error' : 'primary'"
            :loading="pending"
            :disabled="pending"
            :data-testid="confirmTestId"
            @click="$emit('confirm')"
            >{{ confirmLabel }}</UButton
          >
        </div>
      </div>
    </template>
  </UModal>
</template>
