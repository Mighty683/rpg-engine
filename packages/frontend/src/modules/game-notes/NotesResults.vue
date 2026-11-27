<script setup lang="ts">
import NoteCardSkeleton from "./NoteCardSkeleton.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import { computed, onMounted, onUnmounted } from "vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import { nearBottom } from "./list-scroll";
import NoteCard from "./NoteCard.vue";
import type { Notebook } from "./notebook";

/**
 * Notebook browse/search screen: a blank query lists every entry newest
 * first; a typed query searches the whole notebook case-insensitively.
 * Results page with the cursor and append the next batch near the bottom.
 */
const props = defineProps<{ notebook: Notebook }>();
const emit = defineEmits<{ open: [entryId: string] }>();
const browse = computed(() => props.notebook.browse);
const entries = computed(() =>
  props.notebook.browse.ids.flatMap((id) => {
    const entry = props.notebook.displayEntry(id);
    return entry ? [entry] : [];
  }),
);
const emptyKind = computed(() => (props.notebook.browse.term.trim() ? "no-match" : "empty"));

function onWindowScroll() {
  if (nearBottom(document.documentElement)) props.notebook.loadMoreBrowse();
}

onMounted(() => {
  props.notebook.ensureBrowse();
  window.addEventListener("scroll", onWindowScroll, { passive: true });
});
onUnmounted(() => window.removeEventListener("scroll", onWindowScroll));
</script>

<template>
  <div class="space-y-medium">
    <LabeledInput
      :model-value="browse.term"
      label="Search entries"
      placeholder="Search title or content"
      data-testid="notes-search"
      @update:model-value="notebook.setTerm(String($event))"
    />
    <div aria-live="polite" class="space-y-small">
      <SkeletonRegion
        v-if="browse.loading"
        label="Loading entries…"
        data-testid="notes-loading"
        class="space-y-small"
      >
        <NoteCardSkeleton v-for="row in 2" :key="row" />
      </SkeletonRegion>
      <ContentState
        v-else-if="browse.failed"
        kind="error"
        retry-test-id="notes-retry"
        @retry="notebook.retryBrowse()"
      />
      <ContentState v-else-if="!entries.length" kind="empty" :data-testid="`notes-${emptyKind}`">
        {{ emptyKind === "no-match" ? "No matching entries." : "No entries yet." }}
      </ContentState>
      <template v-else>
        <ul class="space-y-small" data-testid="notes-list">
          <li v-for="entry in entries" :key="entry.id">
            <NoteCard :entry="entry" clickable @open="emit('open', entry.id)" />
          </li>
        </ul>
        <SkeletonRegion v-if="browse.loadingMore" label="Loading entries…"
          ><NoteCardSkeleton
        /></SkeletonRegion>
        <ContentState
          v-else-if="browse.moreFailed"
          kind="error"
          retry-test-id="notes-retry-more"
          @retry="notebook.loadMoreBrowse()"
        />
      </template>
    </div>
  </div>
</template>
