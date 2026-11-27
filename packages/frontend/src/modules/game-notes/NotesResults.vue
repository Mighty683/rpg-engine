<script setup lang="ts">
import { tr } from "../../shared/i18n";
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
      :label="tr('ui.searchEntries')"
      :placeholder="tr('ui.searchTitleOrContent')"
      data-testid="notes-search"
      @update:model-value="notebook.setTerm(String($event))"
    />
    <div aria-live="polite" class="space-y-small">
      <SkeletonRegion
        v-if="browse.loading"
        :label="tr('ui.loadingEntries')"
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
        {{ emptyKind === "no-match" ? tr("ui.noMatchingEntries") : tr("ui.noEntriesYet") }}
      </ContentState>
      <template v-else>
        <ul class="space-y-small" data-testid="notes-list">
          <li v-for="entry in entries" :key="entry.id">
            <NoteCard :entry="entry" clickable @open="emit('open', entry.id)" />
          </li>
        </ul>
        <SkeletonRegion v-if="browse.loadingMore" :label="tr('ui.loadingEntries')"
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
