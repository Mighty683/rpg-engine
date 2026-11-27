<script setup lang="ts">
import { tr } from "../../shared/i18n";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
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
      :aria-label="tr('ui.conversationWithAgent')"
      data-testid="agent-result"
    >
      <SkeletonRegion
        v-if="checking && !messages.length"
        :label="tr('ui.connectingToAgent')"
        class="space-y-small"
      >
        <SkeletonBlock class="ml-auto h-7 w-2/5" /><SkeletonBlock class="h-10 w-3/4" />
      </SkeletonRegion>
      <p v-else-if="!messages.length" class="text-muted">
        {{ tr("ui.whatWouldYouLikeToDoAtTheTable") }}
      </p>
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
          {{ tr("ui.toolValue1", { value1: message.text }) }}
        </p>
        <p
          v-else-if="!message.roll"
          class="max-w-[90%] whitespace-pre-wrap break-words rounded-panel px-small py-tight"
          :class="message.role === 'user' ? 'bg-primary text-inverted' : 'bg-elevated'"
        >
          <span class="sr-only">{{ message.role === "user" ? tr("ui.you") : tr("ui.agent") }}</span>
          {{ message.text }}
        </p>
        <slot name="after-message" :message="message" />
      </div>
    </div>
    <p v-if="busy" class="px-small pb-tight text-small text-muted" role="status">
      {{ tr("ui.agentIsWorking") }}
    </p>
    <p
      v-else-if="!checking && !available"
      class="px-small pb-tight text-small text-muted"
      role="status"
      data-testid="agent-offline"
    >
      {{ tr("ui.agentUnavailableYourMessageIsKeptHere") }}
    </p>
    <p
      v-else-if="!checking && !partyReady && !partyLoading"
      class="px-small pb-tight text-small text-muted"
      role="status"
    >
      {{ tr("ui.tableDataIsUnavailable") }}
    </p>
    <form
      class="flex items-center gap-small border-t border-default p-medium"
      @submit.prevent="canSend && emit('submit')"
    >
      <UInput
        v-model="draft"
        class="min-w-0 flex-1"
        :aria-label="tr('ui.message')"
        :placeholder="tr('ui.messageAgent')"
        data-testid="agent-command"
      />
      <SkeletonRegion
        v-if="!checking && available && partyLoading"
        :label="tr('ui.connectingToTheTable')"
        ><SkeletonBlock class="h-8 w-14"
      /></SkeletonRegion>
      <UButton v-else type="submit" :disabled="!canSend" data-testid="agent-submit">{{
        tr("ui.send")
      }}</UButton>
    </form>
  </div>
</template>
