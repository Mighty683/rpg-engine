<script setup lang="ts">
withDefaults(
  defineProps<{ kind: "loading" | "empty" | "error"; retryLabel?: string; retryTestId?: string }>(),
  {
    retryLabel: "Retry",
  },
);
defineEmits<{ retry: [] }>();
</script>

<template>
  <div :role="kind === 'loading' ? 'status' : undefined" class="space-y-small">
    <p v-if="$slots.default" :class="kind === 'empty' ? 'text-muted' : undefined"><slot /></p>
    <UButton
      v-if="kind === 'error'"
      color="neutral"
      variant="outline"
      :data-testid="retryTestId"
      @click="$emit('retry')"
      >{{ retryLabel }}</UButton
    >
  </div>
</template>
