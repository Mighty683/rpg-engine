<script setup lang="ts">
import { tr } from "../../shared/i18n";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import FormActions from "../../shared/design-system/base/FormActions.vue";
import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";
import EntryDetail from "./EntryDetail.vue";
import NoteEntryFields from "./NoteEntryFields.vue";
import NotesResults from "./NotesResults.vue";
import { useNotebook } from "./useNotebook";

const props = defineProps<{ gameId: string }>();
const route = useRoute();
const router = useRouter();
const notebook = useNotebook(props.gameId);
const notesPath = `/games/${props.gameId}/notes`;
const entryId = String(route.params.entryId ?? "");
const creating = computed(() => route.name === "note-new");
function entryPath(id: string) {
  return `${notesPath}/${id}`;
}

async function submitCreate() {
  const entry = await notebook.createEntry();
  if (!entry) return;
  await router.replace(entryPath(entry.id));
}

function cancelCreate() {
  void router.push(notesPath);
}
</script>

<template>
  <div data-testid="notes-screen" class="mx-auto max-w-6xl space-y-section">
    <header class="flex flex-wrap items-center justify-between gap-medium">
      <div>
        <h1 class="text-heading font-semibold" data-testid="notes-heading">
          {{ creating ? tr("ui.newEntry") : entryId ? tr("ui.entryDetails") : tr("ui.gameNotes") }}
        </h1>
      </div>
      <UButton v-if="!creating" :to="`${notesPath}/new`" data-testid="note-new">{{
        tr("ui.newEntry")
      }}</UButton>
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
          :submit-label="tr('ui.createEntry')"
          submit-test-id="note-create"
          cancel-test-id="note-cancel"
          :pending="notebook.creating.value"
          @cancel="cancelCreate"
        />
      </form>
    </ScreenSection>
    <EntryDetail v-else-if="entryId" :entry-id="entryId" :game-id="gameId" />
    <NotesResults v-else :notebook="notebook" @open="router.push(entryPath($event))" />
  </div>
</template>
