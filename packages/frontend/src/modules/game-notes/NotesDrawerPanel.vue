<script setup lang="ts">
import NoteCardSkeleton from "./NoteCardSkeleton.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import { nearBottom } from "./list-scroll";
import NoteCard from "./NoteCard.vue";
import { useNotebook } from "./useNotebook";

/**
 * Game notes drawer over the GM table: the newest entries first as full cards,
 * paginated with load-more on scroll. Selecting a card opens the entry on the
 * notes screen; "Search all entries" links there too.
 */
const props = defineProps<{ gameId: string }>();
const notebook = useNotebook(props.gameId);
const router = useRouter();
const list = ref<HTMLElement>();
const entries = computed(() =>
  notebook.recent.ids.flatMap((id) => {
    const entry = notebook.displayEntry(id);
    return entry ? [entry] : [];
  }),
);
const notesPath = computed(() => `/games/${props.gameId}/notes`);

onMounted(() => notebook.refreshRecent());

function onScroll() {
  if (list.value && nearBottom(list.value)) notebook.loadMoreRecent();
}

function openEntry(id: string) {
  void router.push(`${notesPath.value}/${id}`);
}
</script>

<template>
  <div class="space-y-medium" data-testid="notes-panel">
    <ULink :to="notesPath" data-testid="notes-open-search" class="notes-link text-primary underline"
      >Search all entries</ULink
    >
    <SkeletonRegion
      v-if="notebook.recent.loading"
      label="Loading entries…"
      data-testid="notes-loading"
      class="space-y-small"
    >
      <NoteCardSkeleton v-for="row in 2" :key="row" />
    </SkeletonRegion>
    <ContentState
      v-else-if="notebook.recent.failed"
      kind="error"
      retry-test-id="notes-drawer-retry"
      @retry="notebook.refreshRecent()"
    />
    <ContentState v-else-if="!entries.length" kind="empty" data-testid="notes-empty"
      >No entries yet.</ContentState
    >
    <div
      v-else
      ref="list"
      class="notes-drawer-list space-y-small overflow-y-auto"
      data-testid="notes-drawer-list"
      @scroll.passive="onScroll"
    >
      <NoteCard
        v-for="entry in entries"
        :key="entry.id"
        :entry="entry"
        clickable
        :test-id="'recent-note-' + entry.id"
        @open="openEntry(entry.id)"
      />
      <SkeletonRegion v-if="notebook.recent.loadingMore" label="Loading entries…"
        ><NoteCardSkeleton
      /></SkeletonRegion>
      <ContentState
        v-else-if="notebook.recent.moreFailed"
        kind="error"
        retry-test-id="notes-drawer-retry-more"
        @retry="notebook.loadMoreRecent()"
      />
    </div>
  </div>
</template>

<style scoped>
.notes-link {
  display: inline-block;
}
.notes-drawer-list {
  max-height: min(65vh, 32rem);
  overscroll-behavior: contain;
}
</style>
