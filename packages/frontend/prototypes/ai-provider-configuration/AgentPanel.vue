<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  available: boolean;
  partyReady: boolean;
  partyLoading: boolean;
  example: string;
  reply: string;
}>();
const draft = defineModel<string>("draft", { required: true });
const emit = defineEmits<{ submit: [] }>();

const canSubmit = computed(
  () => props.available && props.partyReady && Boolean(draft.value.trim()),
);
</script>

<template>
  <div class="space-y-section" data-testid="prototype-agent-panel">
    <p v-if="!available" class="text-muted" role="status" data-testid="prototype-agent-offline">
      Agent unavailable. You can keep editing your command.
    </p>
    <p v-else-if="!partyReady" class="text-muted" role="status">
      {{ partyLoading ? "Waiting for table data…" : "Table data is unavailable." }}
    </p>

    <form class="space-y-small" @submit.prevent="canSubmit && emit('submit')">
      <UFormField label="Command">
        <UInput
          v-model="draft"
          class="w-full"
          placeholder="Ask the agent to do something at this table"
          data-testid="prototype-agent-command"
        />
      </UFormField>
      <div class="flex flex-wrap justify-between gap-small">
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          data-testid="prototype-agent-example"
          @click="draft = example"
        >
          {{ example }}
        </UButton>
        <UButton type="submit" :disabled="!canSubmit" data-testid="prototype-agent-submit">
          Run command
        </UButton>
      </div>
    </form>

    <div aria-live="polite" data-testid="prototype-agent-result">
      <div v-if="reply" class="space-y-tight rounded-panel bg-elevated p-large">
        <p class="font-semibold">Agent</p>
        <p>{{ reply }}</p>
      </div>
    </div>
  </div>
</template>
