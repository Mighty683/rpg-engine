/**
 * Game notes controller state: one notebook per game, with cursor-paged
 * drawer and search lists, entry editors with `useOptimisticSave` queues,
 * and a new-entry draft. The factory is transport-agnostic so the paging,
 * superseded-response, recovery and draft rules are unit-testable; the
 * `useNotebook` hook wires it to the injected HTTP client and toasts.
 * State is cleared on sign-out, access loss and game switch through
 * `dispose`, and late responses are ignored via per-list version guards.
 */
import { effectScope, reactive, ref, watch } from "vue";
import type { Ref } from "vue";
import { newUuid } from "../../shared/uuid";
import { useOptimisticSave } from "../../shared/useOptimisticSave";
import type { SaveError } from "../../shared/types";
import { noteDocument, noteTitleIssue, sameNoteDocument } from "./note-document";
import type { GameNotesClient, NoteDocument, NoteEntry, NoteEntryChanges } from "./types";

type NoteNoticeKind = "error" | "success";
export type NoteNotice = {
  title: string;
  kind: NoteNoticeKind;
  description?: string;
  retry?: () => Promise<void> | void;
};
export type NoteNotify = (notice: NoteNotice) => void;

type NoteListState = {
  ids: string[];
  nextCursor: string | null;
  /** First page in flight; appended pages use `loadingMore`. */
  loading: boolean;
  loadingMore: boolean;
  /** The first page never loaded (or its last attempt failed). */
  failed: boolean;
  /** The last appended batch failed; a retry control stays at the list bottom. */
  moreFailed: boolean;
};

type EntryEditor = {
  readonly id: string;
  fields: { title: string; content: NoteDocument };
  readonly displayed: Ref<NoteEntry | null>;
  readonly saving: Ref<boolean>;
  readonly paused: Ref<boolean>;
  /** Validate the typed fields and queue only what changed since the optimistic view. */
  commit: () => void;
  /** Explicit recovery: refresh the server version, then reapply the retained text. */
  retry: () => Promise<void>;
};

export type Notebook = {
  readonly draft: { id: string; title: string; content: NoteDocument };
  readonly recent: NoteListState;
  readonly browse: NoteListState & { term: string };
  readonly creating: Ref<boolean>;
  setTerm: (value: string) => void;
  ensureBrowse: () => void;
  retryBrowse: () => void;
  loadMoreBrowse: () => void;
  /** Called when the drawer opens: refresh the first page of recent entries. */
  refreshRecent: () => void;
  loadMoreRecent: () => void;
  entry: (id: string) => NoteEntry | undefined;
  /** Record shown on cards: the optimistic editor view while one exists. */
  displayEntry: (id: string) => NoteEntry | undefined;
  loadEntry: (id: string) => Promise<void>;
  editorFor: (id: string) => EntryEditor | undefined;
  /** Creates from the draft; resolves to the saved entry, or null when nothing was saved. */
  createEntry: () => Promise<NoteEntry | null>;
  dispose: () => void;
};

export function createNotebook(
  gameId: string,
  api: GameNotesClient,
  notify: NoteNotify,
  searchDelayMs = 250,
): Notebook {
  // The notebook is shared by the drawer and routed pages across component unmounts.
  const scope = effectScope(true);
  const entries = new Map<string, NoteEntry>();
  const editors = new Map<string, EntryEditor>();
  const recent: NoteListState = reactive({
    ids: [],
    nextCursor: null,
    loading: false,
    loadingMore: false,
    failed: false,
    moreFailed: false,
  });
  const browse: NoteListState & { term: string } = reactive({
    ids: [],
    nextCursor: null,
    loading: false,
    loadingMore: false,
    failed: false,
    moreFailed: false,
    term: "",
  });
  const draft = reactive({ id: newUuid(), title: "", content: noteDocument() });
  const creating = ref(false);
  let generation = 0;
  let recentVersion = 0;
  let browseVersion = 0;
  let lastQuery: string | null = "";
  let browseTimer: ReturnType<typeof setTimeout> | undefined;

  function isLostAccess(error: unknown) {
    const status = (error as { status?: number }).status;
    return status === 403 || status === 404;
  }

  /** Reports load/save failures; clears notebook state once access is lost. */
  function report(error: unknown, title: string, retry?: () => Promise<void> | void) {
    const problem = error as SaveError & { payload?: { error?: { message?: string } } };
    if (isLostAccess(error)) {
      notify({ title: "You no longer have access to game notes for this game.", kind: "error" });
      dispose();
      return;
    }
    notify({
      title,
      kind: "error",
      description: problem?.payload?.error?.message,
      ...(retry ? { retry } : {}),
    });
  }

  /** Newest first by the acknowledged update time, then by entry ID. */
  function byNewest(a: NoteEntry, b: NoteEntry) {
    return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
  }

  function resort(list: NoteListState) {
    const known = list.ids.filter((id) => entries.has(id));
    const byId = new Map(known.map((id) => [id, entries.get(id)!]));
    known.sort((a, b) => byNewest(byId.get(a)!, byId.get(b)!));
    list.ids = known;
  }

  function displayEntry(id: string) {
    return editors.get(id)?.displayed.value ?? entries.get(id);
  }

  function recordPage(
    page: { entries: NoteEntry[]; nextCursor: string | null },
    list: NoteListState,
    prepend: boolean,
  ) {
    const pageIds = page.entries.map((entry) => entry.id);
    for (const entry of page.entries) entries.set(entry.id, entry);
    if (prepend) {
      const previous = list.ids.filter((id) => !pageIds.includes(id));
      list.ids = [...pageIds, ...previous];
    } else {
      const seen = new Set(list.ids);
      list.ids = [...list.ids, ...pageIds.filter((id) => !seen.has(id))];
    }
    list.nextCursor = page.nextCursor;
  }

  function refreshRecent() {
    if (recent.loading) return;
    recentVersion += 1;
    const version = recentVersion;
    recent.loading = !recent.ids.length;
    recent.failed = false;
    void (async () => {
      try {
        const page = await api.list(gameId);
        if (version !== recentVersion || generation !== 0) return;
        recordPage(page, recent, true);
        recent.failed = false;
        resort(recent);
      } catch (error) {
        if (version !== recentVersion || generation !== 0) return;
        recent.failed = true;
        report(error, "Could not load game notes. Retry to load the entries.");
      } finally {
        if (version === recentVersion) {
          recent.loading = false;
          resort(recent);
        }
      }
    })();
  }

  function loadMoreRecent() {
    const cursor = recent.nextCursor;
    if (!cursor || recent.loadingMore || recent.loading) return;
    recentVersion += 1;
    const version = recentVersion;
    recent.loadingMore = true;
    void (async () => {
      try {
        const page = await api.list(gameId, { cursor });
        if (version !== recentVersion || generation !== 0) return;
        recordPage(page, recent, false);
        recent.moreFailed = false;
      } catch (error) {
        if (version !== recentVersion || generation !== 0) return;
        recent.moreFailed = true;
        report(error, "Could not load older entries.");
      } finally {
        if (version === recentVersion) recent.loadingMore = false;
      }
    })();
  }

  async function runBrowse() {
    browseVersion += 1;
    const version = browseVersion;
    browse.loading = true;
    browse.failed = false;
    const q = browse.term.trim();
    try {
      const page = await api.list(gameId, q ? { q } : {});
      if (version !== browseVersion || generation !== 0) return;
      for (const entry of page.entries) entries.set(entry.id, entry);
      browse.ids = page.entries.map((entry) => entry.id);
      browse.nextCursor = page.nextCursor;
      browse.failed = false;
    } catch (error) {
      if (version !== browseVersion || generation !== 0) return;
      browse.failed = true;
      report(error, "Could not load game notes. Retry to load the entries.");
    } finally {
      if (version === browseVersion) browse.loading = false;
    }
  }

  function setTerm(value: string) {
    browse.term = value;
    const q = value.trim();
    if (q === lastQuery) return;
    lastQuery = q;
    browse.ids = [];
    browse.nextCursor = null;
    browse.failed = false;
    browseVersion += 1;
    clearTimeout(browseTimer);
    browseTimer = setTimeout(() => {
      browseTimer = undefined;
      void runBrowse();
    }, searchDelayMs);
  }

  function ensureBrowse() {
    if (!browse.ids.length && !browse.loading && !browse.failed) void runBrowse();
  }

  function retryBrowse() {
    void runBrowse();
  }

  function loadMoreBrowse() {
    const cursor = browse.nextCursor;
    if (!cursor || browse.loadingMore || browse.loading) return;
    browseVersion += 1;
    const version = browseVersion;
    const q = browse.term.trim();
    browse.loadingMore = true;
    void (async () => {
      try {
        const page = await api.list(gameId, { q, cursor });
        if (version !== browseVersion || generation !== 0) return;
        recordPage(page, browse, false);
        browse.moreFailed = false;
      } catch (error) {
        if (version !== browseVersion || generation !== 0) return;
        browse.moreFailed = true;
        report(error, "Could not load older entries.");
      } finally {
        if (version === browseVersion) browse.loadingMore = false;
      }
    })();
  }

  function makeEditor(entry: NoteEntry): EntryEditor {
    const fields = reactive({ title: entry.title, content: entry.content });
    /**
     * The values this editor last had acknowledged by a save of its own.
     * Commits diff against this baseline, never against refreshed server
     * state, so an explicit retry reapplies only the retained typed text and
     * never silently undoes a concurrent session's change.
     */
    const synced = reactive({ title: entry.title, content: entry.content });
    const queue = useOptimisticSave<NoteEntry, NoteEntryChanges>({
      apply: (base, changes) => ({ ...base, ...changes }),
      merge: (previous, next) => ({ ...previous, ...next }),
      save: async (base, changes) => {
        const saved = await api.update(gameId, entry.id, {
          expectedRevision: base.revision,
          changes,
        });
        if (changes.title !== undefined) synced.title = saved.title;
        if (changes.content !== undefined) synced.content = saved.content;
        await Promise.resolve();
        return saved;
      },
      refresh: () => api.read(gameId, entry.id),
    });
    queue.setSnapshot(entry);
    const commit = () => {
      const base = queue.displayed.value;
      if (!base) return;
      const title = fields.title.trim();
      if (!title) {
        notify({ title: "Enter a title to save this entry.", kind: "error" });
        return;
      }
      const issue = noteTitleIssue(title);
      if (issue) {
        notify({ title: issue, kind: "error" });
        return;
      }
      const changes: NoteEntryChanges = {};
      if (title !== synced.title) changes.title = title;
      if (!sameNoteDocument(fields.content, synced.content)) changes.content = fields.content;
      if (Object.keys(changes).length) queue.submit(changes);
    };
    const retry = async () => {
      await queue.retry();
      if (!queue.paused.value) commit();
    };
    watch(
      () => queue.error.value,
      (failure) => {
        if (!failure) return;
        if (isLostAccess(failure)) {
          notify({
            title: "You no longer have access to game notes for this game.",
            kind: "error",
          });
          dispose();
          return;
        }
        // Confirmed rejections (400/422) restore the acknowledged result already;
        // recovery retry is for uncertain or conflicting writes only.
        const confirmed = failure.status === 400 || failure.status === 422;
        report(
          failure,
          "Could not save this entry. Your text is available in the editor.",
          confirmed ? undefined : retry,
        );
      },
    );
    watch(
      () => queue.acknowledged.value,
      (acknowledged) => {
        if (!acknowledged) return;
        entries.set(acknowledged.id, acknowledged);
        resort(recent);
        resort(browse);
      },
    );
    const editor: EntryEditor = {
      id: entry.id,
      fields,
      displayed: queue.displayed,
      saving: queue.saving,
      paused: queue.paused,
      commit,
      retry,
    };
    editors.set(entry.id, editor);
    return editor;
  }

  function editorFor(id: string) {
    const existing = editors.get(id);
    if (existing) return existing;
    const record = entries.get(id);
    if (!record) return undefined;
    return scope.run(() => makeEditor(record));
  }

  async function loadEntry(id: string) {
    if (editorFor(id)) return;
    const entry = await api.read(gameId, id);
    if (generation === 0 && !entries.has(id)) entries.set(id, entry);
  }

  async function createEntry(): Promise<NoteEntry | null> {
    if (creating.value) return null;
    const title = draft.title.trim();
    if (!title) {
      notify({ title: "Give the entry a title.", kind: "error" });
      return null;
    }
    const issue = noteTitleIssue(title);
    if (issue) {
      notify({ title: issue, kind: "error" });
      return null;
    }
    creating.value = true;
    const content = draft.content;
    try {
      let entry: NoteEntry;
      try {
        entry = await api.create(gameId, { id: draft.id, title, content });
      } catch (cause) {
        // Uncertain create or duplicate ID: verify by ID before failing; never overwrite a conflicting entry.
        let acknowledged: NoteEntry | null = null;
        try {
          acknowledged = await api.read(gameId, draft.id);
        } catch {
          acknowledged = null;
        }
        if (
          !acknowledged ||
          acknowledged.title !== title ||
          !sameNoteDocument(acknowledged.content, content)
        )
          throw cause;
        entry = acknowledged;
      }
      entries.set(entry.id, entry);
      recent.ids = [entry.id, ...recent.ids.filter((id) => id !== entry.id)];
      browse.ids = [entry.id, ...browse.ids.filter((id) => id !== entry.id)];
      resort(recent);
      resort(browse);
      draft.id = newUuid();
      draft.title = "";
      draft.content = noteDocument();
      notify({ title: "Entry created.", kind: "success" });
      return entry;
    } catch (error) {
      report(error, "Could not create the entry. Your draft is still here.");
      return null;
    } finally {
      creating.value = false;
    }
  }

  function dispose() {
    generation += 1;
    clearTimeout(browseTimer);
    browseTimer = undefined;
    recentVersion += 1;
    browseVersion += 1;
    recent.ids = [];
    recent.nextCursor = null;
    recent.loading = false;
    recent.loadingMore = false;
    recent.failed = false;
    recent.moreFailed = false;
    browse.ids = [];
    browse.nextCursor = null;
    browse.loading = false;
    browse.loadingMore = false;
    browse.failed = false;
    browse.moreFailed = false;
    browse.term = "";
    lastQuery = "";
    draft.id = newUuid();
    draft.title = "";
    draft.content = noteDocument();
    entries.clear();
    editors.clear();
    creating.value = false;
    scope.stop();
  }

  return {
    draft,
    recent,
    browse,
    creating,
    setTerm,
    ensureBrowse,
    retryBrowse,
    loadMoreBrowse,
    refreshRecent,
    loadMoreRecent,
    entry: (id) => entries.get(id) ?? undefined,
    displayEntry,
    loadEntry,
    editorFor,
    createEntry,
    dispose,
  };
}
