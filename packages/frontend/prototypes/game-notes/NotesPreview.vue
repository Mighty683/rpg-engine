<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { useRoute, useRouter } from "vue-router";
import NoteCard from "./NoteCard.vue";
import GameTable from "../../src/modules/game-table/GameTable.vue";
import ContentState from "../../src/shared/design-system/base/ContentState.vue";
import FormActions from "../../src/shared/design-system/base/FormActions.vue";
import LabeledInput from "../../src/shared/design-system/base/LabeledInput.vue";
import ScreenSection from "../../src/shared/design-system/base/ScreenSection.vue";
import { useOptimisticSave } from "../../src/shared/useOptimisticSave";
import { prototypeGameId, resetPrototypeBackend, type PrototypeScenario } from "../api";
import EntryFields from "./EntryFields.vue";
import { noteDocument, sameNoteDocument, visibleNoteText } from "./note-document";
import type { NotesApi, Entry, EntryText } from "./types";

const props = defineProps<{ api: NotesApi; scenario?: PrototypeScenario }>();
resetPrototypeBackend(props.scenario);
const toast = useToast();
const error = (title: string) => toast.add({ title, color: "error" });
const tablePath = `/games/${prototypeGameId}`;
const notesPath = `${tablePath}/notes`;
const newEntryPath = `${notesPath}/new`;
const route = useRoute();
const router = useRouter();
const library = computed(() => route.path === notesPath);
const creating = computed(() => route.path === newEntryPath);
const busy = ref(false);
const loaded = ref(false);
const loading = ref(false);
const failed = ref(false);
const term = ref("");
const selected = ref("");
const draft = reactive({ id: crypto.randomUUID(), title: "", content: noteDocument() });
const records = reactive(new Map<string, ReturnType<typeof entryController>>());

function entryController(entry: Entry) {
  const fields = reactive({ title: entry.title, content: entry.content });
  const queue = useOptimisticSave<Entry, Partial<EntryText>>({
    apply: (base, changes) => ({ ...base, ...changes }),
    merge: (before, after) => ({ ...before, ...after }),
    save: props.api.update,
    refresh: async () => {
      const latest = (await props.api.list()).find((item) => item.id === entry.id);
      if (!latest) throw new Error("Entry unavailable");
      return latest;
    },
  });
  queue.setSnapshot(entry);
  watch(queue.error, (failure) => {
    if (!failure) return;
    toast.add({
      title: "Could not save this entry. Your text is available in the editor.",
      color: "error",
      actions: [
        {
          label: "Retry edits",
          onClick: async () => {
            await queue.retry();
            if (!queue.paused.value) commit();
          },
        },
      ],
    });
  });
  function commit() {
    const base = queue.displayed.value;
    if (!base) return;
    if (!fields.title.trim()) {
      error("Enter a title to save this entry.");
      return;
    }
    const changes: Partial<EntryText> = {};
    if (fields.title.trim() !== base.title) changes.title = fields.title.trim();
    if (!sameNoteDocument(fields.content, base.content)) changes.content = fields.content;
    if (Object.keys(changes).length) queue.submit(changes);
  }
  return reactive({ fields, entry: queue.displayed, commit });
}

watch(
  library,
  (open) => {
    selected.value = "";
    if (open) void loadEntries();
  },
  { immediate: true },
);

async function loadEntries() {
  if (loaded.value || loading.value) return;
  loading.value = true;
  failed.value = false;
  try {
    for (const entry of await props.api.list()) {
      if (!records.has(entry.id)) records.set(entry.id, entryController(entry));
    }
    loaded.value = true;
  } catch {
    failed.value = true;
    error("Could not load game notes. Retry to load the entries.");
  } finally {
    loading.value = false;
  }
}

const entries = computed(() =>
  Array.from(records.keys())
    .map((id) => records.get(id)!.entry!)

    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)),
);
const matches = computed(() => {
  const query = term.value.trim().toLowerCase();
  return entries.value.filter((entry) =>
    [entry.title, visibleNoteText(entry.content)].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
});
const editor = computed(() => records.get(selected.value));
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

async function openEntry(id: string) {
  if (!library.value) await router.push(notesPath);
  if (library.value) selected.value = id;
}

async function create() {
  if (busy.value) return;
  if (!draft.title.trim()) {
    error("Give the entry a title.");
    return;
  }
  busy.value = true;
  try {
    const text = { title: draft.title.trim(), content: draft.content };
    let entry: Entry;
    try {
      entry = await props.api.create(draft.id, text);
    } catch (cause) {
      const found = (await props.api.list()).find((record) => record.id === draft.id);
      if (!found || found.title !== text.title || !sameNoteDocument(found.content, text.content))
        throw cause;
      entry = found;
    }
    records.set(entry.id, entryController(entry));
    Object.assign(draft, { id: crypto.randomUUID(), title: "", content: noteDocument() });
    if (creating.value) {
      await router.replace(notesPath);
      selected.value = entry.id;
    }
    toast.add({ title: "Entry created.", color: "success" });
  } catch {
    error("Could not create the entry. Your draft is still here.");
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="mx-auto min-h-screen max-w-6xl space-y-section bg-default p-section text-default">
    <header class="flex flex-wrap items-center justify-between gap-medium">
      <div>
        <ULink
          v-if="library || creating"
          :to="tablePath"
          class="notes-link text-primary underline"
          data-testid="notes-back"
          >The Lantern Road</ULink
        >
        <h1 class="text-heading font-semibold">
          {{ creating ? "New entry" : library ? "Game notes" : "The Lantern Road" }}
        </h1>
        <p v-if="!library && !creating" class="text-muted">Fabula Ultima · GM</p>
      </div>
      <UButton v-if="library" :to="newEntryPath" data-testid="note-new">New entry</UButton>
    </header>
    <ScreenSection v-if="creating">
      <form class="space-y-medium" @submit.prevent="create">
        <EntryFields
          :title="draft.title"
          :content="draft.content"
          :pending="busy"
          @title="draft.title = $event"
          @content="draft.content = $event"
        />
        <FormActions
          submit-label="Create entry"
          submit-test-id="note-create"
          cancel-test-id="note-cancel"
          :pending="busy"
          @cancel="router.push(notesPath)"
        />
      </form>
    </ScreenSection>
    <GameTable
      v-else-if="!library"
      :game-id="prototypeGameId"
      role="GM"
      :throws-hint="0"
      :panel-tab="{ id: 'notes', label: 'Game notes', color: 'neutral' }"
      @open-panel="loadEntries"
    >
      <template #edge-panel>
        <div class="space-y-medium" data-testid="notes-panel">
          <ULink
            :to="notesPath"
            data-testid="notes-open-search"
            class="notes-link text-primary underline"
            >Search all entries</ULink
          >
          <ContentState v-if="loading" kind="loading">Loading entries…</ContentState>
          <ContentState v-else-if="failed" kind="error" @retry="loadEntries" />
          <ContentState v-else-if="!entries.length" kind="empty">No entries yet.</ContentState>
          <NoteCard
            v-for="entry in entries.slice(0, 3)"
            :key="entry.id"
            :entry="entry"
            clickable
            :data-testid="'recent-note-' + entry.id"
            @open="openEntry(entry.id)"
          />
        </div>
      </template>
    </GameTable>
    <template v-else>
      <LabeledInput
        v-model="term"
        label="Search entries"
        placeholder="Search title or content"
        data-testid="notes-search"
        @update:model-value="selected = ''"
      />
      <ContentState v-if="loading" kind="loading">Loading entries…</ContentState>
      <ContentState v-else-if="failed" kind="error" @retry="loadEntries" />
      <ScreenSection v-else-if="editor && editor.entry">
        <div class="space-y-medium">
          <button
            class="notes-link text-primary underline"
            data-testid="notes-results"
            @click="selected = ''"
          >
            Back to results
          </button>
          <EntryFields
            v-bind="editor.fields"
            @title="editor.fields.title = $event"
            @content="editor.fields.content = $event"
            @commit="editor.commit()"
          />
          <p class="text-small text-muted">
            Created {{ date(editor.entry.createdAt) }} · Updated {{ date(editor.entry.updatedAt) }}
          </p>
        </div>
      </ScreenSection>
      <ContentState v-else-if="!matches.length" kind="empty">{{
        term.trim() ? "No matching entries." : "No entries yet."
      }}</ContentState>
      <ul v-else class="space-y-small">
        <li v-for="entry in matches" :key="entry.id">
          <NoteCard :entry="entry" clickable @open="openEntry(entry.id)" />
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
a.notes-link {
  display: inline-block;
  color: var(--ui-primary);
  text-decoration: underline;
}

a.notes-link:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
</style>
