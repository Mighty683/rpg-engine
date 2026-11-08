<script setup lang="ts">
import ContentState from "../../shared/design-system/ContentState.vue";
import ScreenSection from "../../shared/design-system/ScreenSection.vue";
import { nextTick, onMounted, ref, watch } from "vue";
import type { ThrowRecord } from "./contract";
import ThrowResultCard from "./ThrowResultCard.vue";

const props = defineProps<{
  throws: readonly ThrowRecord[];
  isLoading: boolean;
  isError: boolean;
  hasOlder: boolean;
  highlightId: string;
}>();
const emit = defineEmits<{
  reroll: [entry: ThrowRecord];
  remove: [entry: ThrowRecord];
  loadOlder: [];
  retry: [];
  makeRoll: [];
}>();

const historyList = ref<HTMLOListElement>();
let initialScrolled = false;
let pendingOlder: { scrollHeight: number; scrollTop: number } | null = null;

onMounted(() => {
  void nextTick(() => {
    if (historyList.value && props.throws.length) {
      historyList.value.scrollTop = historyList.value.scrollHeight;
      initialScrolled = true;
    }
  });
});

watch(
  () => props.throws.length,
  async () => {
    await nextTick();
    const list = historyList.value;
    if (!list) return;
    if (pendingOlder) {
      list.scrollTop = pendingOlder.scrollTop + (list.scrollHeight - pendingOlder.scrollHeight);
      pendingOlder = null;
      return;
    }
    if (!initialScrolled && props.throws.length) {
      list.scrollTop = list.scrollHeight;
      initialScrolled = true;
    } else if (props.highlightId) list.scrollTop = list.scrollHeight;
  },
);

watch(
  () => props.throws[props.throws.length - 1]?.id,
  async () => {
    await nextTick();
    if (historyList.value && !pendingOlder) historyList.value.scrollTop = historyList.value.scrollHeight;
  },
);

function loadOlder() {
  const list = historyList.value;
  if (list) pendingOlder = { scrollHeight: list.scrollHeight, scrollTop: list.scrollTop };
  emit("loadOlder");
}
</script>

<template>
  <ScreenSection aria-labelledby="roll-history-heading" class="history-panel space-y-medium p-large">
    <div class="flex flex-wrap items-center justify-between gap-small">
      <h2 id="roll-history-heading" class="text-section font-semibold">Throw history</h2>
      <UButton color="neutral" variant="outline" data-testid="make-roll" @click="$emit('makeRoll')">Make a roll</UButton>
    </div>
    <p v-if="isError" role="alert" class="text-error">
      Could not load throws. <UButton variant="link" data-testid="retry-history" @click="emit('retry')">Retry</UButton>
    </p>
    <template v-else>
      <ContentState v-if="isLoading && !throws.length" kind="loading">Loading throws…</ContentState>
      <ContentState v-else-if="!throws.length" kind="empty" data-testid="history-empty">No throws yet.</ContentState>
      <template v-else>
        <div class="load-older-row flex justify-center">
          <UButton v-if="hasOlder" color="neutral" variant="outline" size="sm" data-testid="load-older-throws" @click="loadOlder">Load older throws</UButton>
        </div>
        <ol
          ref="historyList"
          class="throw-history space-y-small"
          aria-live="polite"
          aria-label="Recent throws"
          tabindex="0"
          data-testid="throw-history"
        >
          <ThrowResultCard
            v-for="entry in throws"
            :key="entry.id"
            :entry="entry"
            :highlighted="highlightId === entry.id"
            @reroll="emit('reroll', entry)"
            @remove="emit('remove', entry)"
          />
        </ol>
      </template>
    </template>
  </ScreenSection>
</template>

<style scoped>
.load-older-row { min-height: 2.25rem; }
.throw-history { max-height: min(60vh, 36rem); overflow-y: auto; overscroll-behavior: contain; }
@media (min-width: 1024px) {
  .history-panel { display: flex; flex-direction: column; height: 0; min-height: 100%; }
  .throw-history { flex: 1; min-height: 0; max-height: none; }
}
</style>
