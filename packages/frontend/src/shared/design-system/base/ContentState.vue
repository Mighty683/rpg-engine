<script setup lang="ts">
import { tr } from "../../i18n";
withDefaults(
  defineProps<{ kind: "empty" | "error"; retryLabel?: string; retryTestId?: string }>(),
  {
    retryLabel: tr("games.retry"),
  },
);
defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="space-y-small">
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
