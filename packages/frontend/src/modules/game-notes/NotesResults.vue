<script setup lang="ts">
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
      <ContentState v-if="browse.loading" kind="loading" data-testid="notes-loading"
        >Loading entries…</ContentState
      >
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
            <NoteCard :entry="entry" clickable @open="notebook.selectEntry(entry.id)" />
          </li>
        </ul>
        <ContentState v-if="browse.loadingMore" kind="loading">Loading entries…</ContentState>
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
