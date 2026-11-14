<script setup lang="ts">
import FormActions from "./FormActions.vue";
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
    :close="close && !pending"
    :dismissible="!pending"
    @update:open="
      (value: boolean) => {
        if (!value && !pending) $emit('cancel');
      }
    "
  >
    <template #body>
      <div class="space-y-medium">
        <slot />
        <FormActions
          :submit-label="confirmLabel"
          :cancel-label="cancelLabel"
          :pending="pending"
          :destructive="destructive"
          submit-type="button"
          :submit-test-id="confirmTestId"
          :cancel-test-id="cancelTestId"
          @cancel="$emit('cancel')"
          @confirm="$emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
