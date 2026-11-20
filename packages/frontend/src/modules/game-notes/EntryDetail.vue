<script setup lang="ts">
import { computed, onUnmounted } from "vue";
import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";
import NoteEntryFields from "./NoteEntryFields.vue";
import { useNotebook } from "./useNotebook";

/**
 * Entry detail, a state of the notes screen: the same labeled fields serve
 * reading and editing. Valid edits display immediately and are saved after
 * 2 idle seconds, or flushed at once when the GM leaves the fields; the
 * client never blocks typing on the in-flight save. Dates come from the
 * server acknowledgement.
 */
const props = defineProps<{ gameId: string }>();
const notebook = useNotebook(props.gameId);
const editor = computed(() => notebook.editorFor(notebook.selectedId.value));
const entry = computed(() => editor.value?.displayed.value ?? null);
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

let idleTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleIdleSave() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = undefined;
    editor.value?.commit();
  }, 2_000);
}

function flush() {
  clearTimeout(idleTimer);
  idleTimer = undefined;
  editor.value?.commit();
}

onUnmounted(() => flush());
</script>

<template>
  <ScreenSection>
    <div class="space-y-medium">
      <button
        type="button"
        class="notes-link text-primary underline"
        data-testid="notes-results"
        @click="notebook.closeEntry()"
      >
        Back to results
      </button>
      <NoteEntryFields
        v-if="editor"
        :title="editor.fields.title"
        :content="editor.fields.content"
        @title="
          editor!.fields.title = $event;
          scheduleIdleSave();
        "
        @content="
          editor!.fields.content = $event;
          scheduleIdleSave();
        "
        @commit="flush"
      />
      <p v-if="entry" class="text-small text-muted" data-testid="note-detail-metadata">
        Created {{ date(entry.createdAt) }} · Updated {{ date(entry.updatedAt) }}
      </p>
    </div>
  </ScreenSection>
</template>

<style scoped>
.notes-link {
  display: inline-block;
}
.notes-link:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
</style>
