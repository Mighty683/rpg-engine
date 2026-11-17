<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { ChatMessage } from "./types";

const props = defineProps<{
  available: boolean;
  partyReady: boolean;
  partyLoading: boolean;
  messages: readonly ChatMessage[];
}>();
const draft = defineModel<string>("draft", { required: true });
const emit = defineEmits<{ submit: [] }>();
const conversation = ref<HTMLElement>();
const canSend = computed(() => props.available && props.partyReady && Boolean(draft.value.trim()));
watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    conversation.value?.scrollTo({ top: conversation.value.scrollHeight });
  },
);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col" data-testid="prototype-agent-panel">
    <div
      ref="conversation"
      class="flex-1 space-y-small overflow-y-auto p-small text-small"
      role="log"
      aria-label="Conversation with Agent"
      data-testid="prototype-agent-result"
    >
      <p v-if="!messages.length" class="text-muted">What would you like to do at the table?</p>
      <div
        v-for="(message, index) in messages"
        :key="index"
        class="flex"
        :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <p
          v-if="message.role === 'tool'"
          class="text-small text-muted"
          data-testid="prototype-agent-tool-call"
        >
          Tool · {{ message.text }}
        </p>
        <p
          v-else
          class="max-w-[90%] whitespace-pre-wrap break-words rounded-panel px-small py-tight"
          :class="message.role === 'user' ? 'bg-primary text-inverted' : 'bg-elevated'"
        >
          <span class="sr-only">{{ message.role === "user" ? "You" : "Agent" }}</span>
          {{ message.text }}
        </p>
      </div>
    </div>
    <p
      v-if="!available"
      class="px-small pb-tight text-small text-muted"
      role="status"
      data-testid="prototype-agent-offline"
    >
      Agent unavailable. Your message is kept here.
    </p>
    <p v-else-if="!partyReady" class="px-small pb-tight text-small text-muted" role="status">
      {{ partyLoading ? "Connecting to the table…" : "Table data is unavailable." }}
    </p>
    <form
      class="flex items-center gap-small border-t border-default p-medium"
      @submit.prevent="canSend && emit('submit')"
    >
      <UInput
        v-model="draft"
        class="min-w-0 flex-1"
        aria-label="Message"
        placeholder="Message Agent…"
        data-testid="prototype-agent-command"
      />
      <UButton type="submit" :disabled="!canSend" data-testid="prototype-agent-submit"
        >Send</UButton
      >
    </form>
  </div>
</template>
