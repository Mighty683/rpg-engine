<script setup lang="ts">
import { tr } from "../../shared/i18n";
import EntryFieldsSkeleton from "./EntryFieldsSkeleton.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import NoteEntryFields from "./NoteEntryFields.vue";
import { useNotebook } from "./useNotebook";

/**
 * Entry detail, a state of the notes screen: the same labeled fields serve
 * reading and editing. Valid edits display immediately and are saved after
 * 2 idle seconds, or flushed at once when the GM leaves the fields; the
 * client never blocks typing on the in-flight save. Dates come from the
 * server acknowledgement.
 */
const props = defineProps<{ gameId: string; entryId: string }>();
const notebook = useNotebook(props.gameId);
const loaded = ref(false);
const failed = ref(false);
const editor = computed(() => (loaded.value ? notebook.editorFor(props.entryId) : undefined));
async function load() {
  failed.value = false;
  try {
    await notebook.loadEntry(props.entryId);
    loaded.value = true;
  } catch {
    failed.value = true;
  }
}
onMounted(load);
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
      <ContentState v-if="failed" kind="error" @retry="load" />
      <SkeletonRegion v-else-if="!editor" :label="tr('ui.loadingEntry')"
        ><EntryFieldsSkeleton
      /></SkeletonRegion>
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
        {{
          tr("ui.createdValue1UpdatedValue2", {
            value1: date(entry.createdAt),
            value2: date(entry.updatedAt),
          })
        }}
      </p>
    </div>
  </ScreenSection>
</template>
