<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { ChatMessage } from "./types";

const props = defineProps<{
  available: boolean;
  busy?: boolean;
  checking?: boolean;
  partyReady: boolean;
  partyLoading: boolean;
  messages: readonly ChatMessage[];
}>();
const draft = defineModel<string>("draft", { required: true });
const emit = defineEmits<{ submit: []; older: [] }>();
const conversation = ref<HTMLElement>();
const canSend = computed(
  () => props.available && props.partyReady && !props.busy && Boolean(draft.value.trim()),
);
function showLatest() {
  const el = conversation.value;
  if (el) el.scrollTop = el.scrollHeight;
}
onMounted(showLatest);

// Keep the same visible message in place when older turns are inserted above it.
watch(
  () => props.messages,
  async () => {
    const el = conversation.value;
    if (!el) return;
    const follow = el.scrollHeight - el.clientHeight - el.scrollTop <= 3;
    const top = el.getBoundingClientRect().top;
    const anchor = follow
      ? undefined
      : [...el.querySelectorAll<HTMLElement>("[data-message-id]")].find(
          (node) => node.getBoundingClientRect().bottom > top,
        );
    const offset = anchor?.getBoundingClientRect().top;
    await nextTick();
    if (follow) showLatest();
    else if (anchor?.isConnected && offset !== undefined)
      el.scrollTop += anchor.getBoundingClientRect().top - offset;
  },
  { deep: true },
);
function onScroll() {
  if (conversation.value && conversation.value.scrollTop <= 1) emit("older");
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col" data-testid="agent-panel">
    <div
      ref="conversation"
      @scroll="onScroll"
      class="flex-1 space-y-small overflow-y-auto p-small text-small"
      role="log"
      aria-label="Conversation with Agent"
      data-testid="agent-result"
    >
      <p v-if="!messages.length" class="text-muted">What would you like to do at the table?</p>
      <div
        v-for="message in messages"
        :data-message-id="message.id"
        :key="message.id"
        class="flex flex-wrap"
        :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <p
          v-if="message.role === 'tool'"
          class="text-small text-muted"
          data-testid="agent-tool-call"
        >
          Tool · {{ message.text }}
        </p>
        <p
          v-else-if="!message.roll"
          class="max-w-[90%] whitespace-pre-wrap break-words rounded-panel px-small py-tight"
          :class="message.role === 'user' ? 'bg-primary text-inverted' : 'bg-elevated'"
        >
          <span class="sr-only">{{ message.role === "user" ? "You" : "Agent" }}</span>
          {{ message.text }}
        </p>
        <slot name="after-message" :message="message" />
      </div>
    </div>
    <p v-if="checking || busy" class="px-small pb-tight text-small text-muted" role="status">
      {{ checking ? "Connecting to Agent…" : "Agent is working…" }}
    </p>
    <p
      v-else-if="!available"
      class="px-small pb-tight text-small text-muted"
      role="status"
      data-testid="agent-offline"
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
        data-testid="agent-command"
      />
      <UButton type="submit" :disabled="!canSend" data-testid="agent-submit">Send</UButton>
    </form>
  </div>
</template>
