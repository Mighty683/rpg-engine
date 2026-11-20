<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import FormActions from "../../shared/design-system/base/FormActions.vue";
import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";
import EntryDetail from "./EntryDetail.vue";
import NoteEntryFields from "./NoteEntryFields.vue";
import NotesResults from "./NotesResults.vue";
import { useNotebook } from "./useNotebook";

/**
 * Notes screen controller for both game-notes routes: the list and entry
 * detail on `/games/:gameId/notes`, entry creation on `/games/:gameId/notes/new`.
 * Creating replaces the route with the saved entry detail; cancelling keeps
 * the draft for the same game, including formatting, until a create succeeds.
 * Entry detail is a screen state: arriving at the list route clears the
 * selection, so direct visits start at the results.
 */
const props = defineProps<{ gameId: string; gameName: string }>();
const route = useRoute();
const router = useRouter();
const notebook = useNotebook(props.gameId);
// The app remounts per route path, so this runs on every notes route arrival,
// always before an awaited navigation that then selects a drawer or new entry.
notebook.closeEntry();
const tablePath = computed(() => `/games/${props.gameId}`);
const notesPath = computed(() => `${tablePath.value}/notes`);
const creating = computed(() => route.path.endsWith("/new"));
const detailOpen = computed(() => Boolean(notebook.selectedId.value));

async function submitCreate() {
  const entry = await notebook.createEntry();
  if (!entry) return;
  if (creating.value) await router.replace(notesPath.value);
  notebook.selectEntry(entry.id);
}

function cancelCreate() {
  void router.push(notesPath.value);
}
</script>

<template>
  <main data-testid="notes-screen" class="mx-auto max-w-6xl space-y-section">
    <header class="flex flex-wrap items-center justify-between gap-medium">
      <div>
        <ULink
          :to="tablePath"
          data-testid="notes-back"
          class="notes-link text-small text-primary underline"
          >{{ gameName }}</ULink
        >
        <h1 class="text-heading font-semibold" data-testid="notes-heading">
          {{ creating ? "New entry" : "Game notes" }}
        </h1>
      </div>
      <UButton v-if="!creating" :to="`${notesPath}/new`" data-testid="note-new">New entry</UButton>
    </header>
    <ScreenSection v-if="creating">
      <form class="space-y-medium" @submit.prevent="submitCreate">
        <NoteEntryFields
          :title="notebook.draft.title"
          :content="notebook.draft.content"
          :pending="notebook.creating.value"
          @title="notebook.draft.title = $event"
          @content="notebook.draft.content = $event"
        />
        <FormActions
          submit-label="Create entry"
          submit-test-id="note-create"
          cancel-test-id="note-cancel"
          :pending="notebook.creating.value"
          @cancel="cancelCreate"
        />
      </form>
    </ScreenSection>
    <EntryDetail v-else-if="detailOpen" :key="notebook.selectedId.value" :game-id="gameId" />
    <NotesResults v-else :notebook="notebook" />
  </main>
</template>

<style scoped>
a.notes-link {
  display: inline-block;
}

a.notes-link:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
</style>
