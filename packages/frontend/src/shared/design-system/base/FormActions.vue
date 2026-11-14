<script setup lang="ts">
withDefaults(
  defineProps<{
    submitLabel: string;
    cancelLabel?: string;
    pending?: boolean;
    blocked?: boolean;
    destructive?: boolean;
    submitType?: "submit" | "button";
    submitTestId?: string;
    cancelTestId?: string;
  }>(),
  { cancelLabel: "Cancel", submitType: "submit" },
);
defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <div class="flex flex-wrap justify-end gap-small" :aria-busy="pending">
    <UButton
      type="button"
      color="neutral"
      variant="outline"
      :disabled="pending"
      :data-testid="cancelTestId"
      @click="$emit('cancel')"
      >{{ cancelLabel }}</UButton
    >
    <UButton
      :type="submitType"
      :color="destructive ? 'error' : 'primary'"
      variant="solid"
      :loading="pending"
      :disabled="pending || blocked"
      :data-testid="submitTestId"
      @click="$emit('confirm')"
      >{{ submitLabel }}</UButton
    >
  </div>
</template>
