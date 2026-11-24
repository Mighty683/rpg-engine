import { describe, expect, it, vi } from "vite-plus/test";
import { createNotebook, type NoteNotice } from "./notebook";
import { noteDocument } from "./note-document";
import type { GameNotesClient, NoteEntry, NotePage } from "./types";

/**
 * Unit coverage for the game notes controller factory: drawer and search
 * cursor paging with superseded-response guards, editor saves queued through
 * `useOptimisticSave` with conflict recovery, create reconciliation, and
 * state clearing. The HTTP contract itself is covered by the packages/tests
 * integration and browser suites against the real backend.
 */

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const entry = (id: string, updatedAt: string, over: Partial<NoteEntry> = {}): NoteEntry => ({
  id,
  title: `Title ${id}`,
  content: { ops: [{ insert: `Body ${id}\n` }] },
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt,
  revision: 1,
  ...over,
});

const page = (entries: NoteEntry[], nextCursor: string | null = null): NotePage => ({
  entries,
  nextCursor,
});

function failure(status: number, message: string) {
  return Object.assign(new Error(`Request failed (${status})`), {
    status,
    payload: { error: { code: "error", message } },
  });
}

type Handlers = {
  list: ((query: { q?: string; cursor?: string }) => Promise<NotePage>)[];
  read?: (entryId: string) => Promise<NoteEntry>;
  create?: (input: { id: string; title: string }) => Promise<NoteEntry>;
  update?: (
    entryId: string,
    input: { expectedRevision: number; changes: Record<string, unknown> },
  ) => Promise<NoteEntry>;
};

function fixture() {
  const handlers: Handlers = { list: [] };
  const calls = {
    list: [] as { q?: string; cursor?: string }[],
    reads: [] as string[],
    creates: [] as { id: string; title: string }[],
    updates: [] as { entryId: string; expectedRevision: number }[],
  };
  const api: GameNotesClient = {
    list: (_gameId, query = {}) => {
      calls.list.push({ q: query.q, cursor: query.cursor });
      return handlers.list.shift()?.(query) ?? Promise.resolve(page([]));
    },
    read: (_gameId, entryId) => {
      calls.reads.push(entryId);
      return handlers.read ? handlers.read(entryId) : Promise.reject(new Error("no read handler"));
    },
    create: (_gameId, input) => {
      calls.creates.push({ id: input.id, title: input.title });
      return handlers.create
        ? handlers.create({ id: input.id, title: input.title })
        : Promise.reject(new Error("no create handler"));
    },
    update: (_gameId, entryId, input) => {
      calls.updates.push({ entryId, expectedRevision: input.expectedRevision });
      return handlers.update
        ? handlers.update(entryId, {
            expectedRevision: input.expectedRevision,
            changes: input.changes as Record<string, unknown>,
          })
        : Promise.reject(new Error("no update handler"));
    },
  };
  return { api, calls, handlers };
}

function recorder() {
  const notices: NoteNotice[] = [];
  const notify = (notice: NoteNotice) => notices.push(notice);
  return { notices, notify };
}

const notebookWith = (
  api: GameNotesClient,
  notify: (notice: NoteNotice) => void,
  searchDelayMs = 0,
) => createNotebook("game", api, notify, searchDelayMs);

describe("drawer and search cursor paging", () => {
  it("merges appended pages newest first, deduplicates by id and stops at the end", async () => {
    const { api, calls, handlers } = fixture();
    const { notify } = recorder();
    const alpha = entry("a", "2026-11-03T12:00:00.000Z");
    const beta = entry("b", "2026-11-02T12:00:00.000Z");
    const gamma = entry("c", "2026-11-01T12:00:00.000Z");
    handlers.list = [
      () => Promise.resolve(page([alpha, beta, gamma], "cursor-1")),
      (query) => {
        expect(query.cursor).toBe("cursor-1");
        return Promise.resolve(page([beta, entry("d", "2026-10-31T12:00:00.000Z")], null));
      },
    ];
    const notebook = notebookWith(api, notify);
    notebook.refreshRecent();
    await vi.waitUntil(() => notebook.recent.ids.length === 3);
    notebook.loadMoreRecent();
    await vi.waitUntil(() => notebook.recent.ids.length === 4);
    expect(notebook.recent.ids).toEqual(["a", "b", "c", "d"]);
    notebook.loadMoreRecent();
    notebook.loadMoreRecent();
    expect(calls.list.length).toBe(2);
    expect(notebook.recent.moreFailed).toBe(false);
  });

  it("resets the search list on a changed query and ignores superseded responses", async () => {
    const { api, calls, handlers } = fixture();
    const { notify } = recorder();
    const first = deferred<NotePage>();
    const second = deferred<NotePage>();
    handlers.list = [() => first.promise, () => second.promise];
    const notebook = notebookWith(api, notify);
    notebook.setTerm("compass");
    await vi.waitFor(() => expect(notebook.browse.loading).toBe(true));
    notebook.setTerm("observatory");
    expect(notebook.browse.ids).toEqual([]);
    first.resolve(page([entry("stale", "2026-11-03T12:00:00.000Z")], null));
    await vi.waitFor(() => expect(calls.list.length).toBe(2));
    second.resolve(page([entry("fresh", "2026-11-04T12:00:00.000Z")], null));
    await vi.waitFor(() => expect(notebook.browse.ids).toEqual(["fresh"]));
    notebook.setTerm("  observatory   ");
    expect(notebook.browse.ids).toEqual(["fresh"]);
    expect(calls.list.length).toBe(2);
    expect(calls.list.map((call) => call.q)).toEqual(["compass", "observatory"]);
  });

  it("retries a failed first page and keeps loaded cards on a failed append", async () => {
    const { api, handlers } = fixture();
    const { notify, notices } = recorder();
    handlers.list = [() => Promise.reject(failure(503, "database down"))];
    const notebook = notebookWith(api, notify);
    notebook.refreshRecent();
    await vi.waitUntil(() => notebook.recent.failed);
    expect(notebook.recent.ids).toEqual([]);
    expect(notices.at(-1)?.title).toBe("Could not load game notes. Retry to load the entries.");

    handlers.list = [
      () =>
        Promise.resolve(
          page(
            [entry("a", "2026-11-03T12:00:00.000Z"), entry("b", "2026-11-02T12:00:00.000Z")],
            "cursor-1",
          ),
        ),
      () => Promise.reject(failure(500, "append failed")),
    ];
    notebook.refreshRecent();
    await vi.waitUntil(() => notebook.recent.ids.length === 2);
    const before = [...notebook.recent.ids];
    notebook.loadMoreRecent();
    await vi.waitUntil(() => notebook.recent.moreFailed);
    expect(notebook.recent.ids).toEqual(before);
    expect(notices.at(-1)?.title).toBe("Could not load older entries.");
  });
});

describe("entry editing with optimistic saves", () => {
  it("saves changed fields at the acknowledged revision and refreshes lists", async () => {
    const { api, calls, handlers } = fixture();
    const { notify } = recorder();
    const saved = entry("a", "2026-11-03T12:00:00.000Z");
    handlers.list = [() => Promise.resolve(page([saved]))];
    handlers.update = (_entryId, input) => {
      expect(input.changes.title).toBe("Renamed");
      return Promise.resolve({
        ...saved,
        title: "Renamed",
        revision: 2,
        updatedAt: "2026-11-05T12:00:00.000Z",
      });
    };
    const notebook = notebookWith(api, notify);
    notebook.refreshRecent();
    await vi.waitUntil(() => notebook.recent.ids.length === 1);
    const editor = notebook.editorFor("a")!;
    expect(calls.updates.length).toBe(0);
    editor.fields.title = "Renamed";
    editor.commit();
    await vi.waitUntil(() => notebook.entry("a")?.title === "Renamed");
    expect(calls.updates).toEqual([{ entryId: "a", expectedRevision: 1 }]);
    expect(editor.displayed.value?.revision).toBe(2);
    expect(notebook.recent.ids).toEqual(["a"]);
  });

  it("keeps the typed draft editable on a revision conflict and reapplies it on retry", async () => {
    const { api, calls, handlers } = fixture();
    const { notify, notices } = recorder();
    const saved = entry("a", "2026-11-03T12:00:00.000Z");
    handlers.list = [() => Promise.resolve(page([saved]))];
    const concurrent = { ...saved, title: "Edited elsewhere", revision: 4 };
    handlers.update = (entryId) => {
      expect(entryId).toBe("a");
      return Promise.reject(failure(409, "The request conflicts with current state."));
    };
    handlers.read = () => Promise.resolve(concurrent);
    const notebook = notebookWith(api, notify);
    notebook.refreshRecent();
    await vi.waitUntil(() => notebook.recent.ids.length === 1);
    const editor = notebook.editorFor("a")!;
    editor.fields.content = noteDocument("retained body");
    editor.commit();
    await vi.waitUntil(() => editor.paused.value === true);
    expect(editor.fields.content).toEqual(noteDocument("retained body"));
    const recovery = notices.find((notice) => notice.retry);
    expect(recovery?.title).toBe(
      "Could not save this entry. Your text is available in the editor.",
    );
    handlers.update = (_entryId, input) => {
      expect(input.expectedRevision).toBe(4);
      expect(input.changes.content).toEqual(noteDocument("retained body"));
      return Promise.resolve({
        ...concurrent,
        content: noteDocument("retained body"),
        revision: 5,
        updatedAt: "2026-11-06T12:00:00.000Z",
      });
    };
    await recovery!.retry!();
    await vi.waitUntil(() => notebook.entry("a")?.revision === 5);
    expect(calls.updates.map((call) => call.expectedRevision)).toEqual([1, 4]);
    expect(notebook.displayEntry("a")?.content).toEqual(noteDocument("retained body"));
  });

  it("does not queue invalid titles and keeps the draft editable", async () => {
    const { api, calls, handlers } = fixture();
    const { notify, notices } = recorder();
    const saved = entry("a", "2026-11-03T12:00:00.000Z");
    handlers.list = [() => Promise.resolve(page([saved]))];
    const notebook = notebookWith(api, notify);
    notebook.refreshRecent();
    await vi.waitUntil(() => notebook.recent.ids.length === 1);
    const editor = notebook.editorFor("a")!;
    editor.fields.title = "   ";
    editor.commit();
    expect(calls.updates.length).toBe(0);
    editor.fields.title = "x".repeat(161);
    editor.commit();
    expect(calls.updates.length).toBe(0);
    expect(notices.map((notice) => notice.title)).toEqual([
      "Enter a title to save this entry.",
      "Use 160 characters or fewer for the title.",
    ]);
  });
});

describe("creating entries", () => {
  it("creates from the draft and resets it only on success", async () => {
    const { api, calls, handlers } = fixture();
    const { notify, notices } = recorder();
    const created = entry("new-1", "2026-11-05T12:00:00.000Z", { title: "Mirror lake" });
    let failedCreates = 0;
    handlers.create = (input) => {
      if (input.title === "Mirror lake") return Promise.resolve(created);
      failedCreates += 1;
      return Promise.reject(failure(500, "create failed"));
    };
    const notebook = notebookWith(api, notify);
    const draftId = notebook.draft.id;
    notebook.draft.title = " Mirror lake ";
    notebook.draft.content = noteDocument("The diver owes Mara a favor.");
    expect(await notebook.createEntry()).toBe(created);
    expect(calls.creates).toEqual([{ id: draftId, title: "Mirror lake" }]);
    expect(notebook.draft.title).toBe("");
    expect(notebook.draft.content).toEqual(noteDocument());
    expect(notebook.draft.id).not.toBe(draftId);

    notebook.draft.title = "No dice";
    handlers.read = () => {
      throw new Error("read should not reconcile a hard failure with a fresh id");
    };
    expect(await notebook.createEntry()).toBeNull();
    expect(failedCreates).toBe(1);
    expect(notebook.draft.title).toBe("No dice");
    expect(notices.at(-1)?.title).toBe("Could not create the entry. Your draft is still here.");
  });

  it("treats a matching entry as an acknowledged uncertain create and never overwrites a conflict", async () => {
    const { api, calls, handlers } = fixture();
    const { notify, notices } = recorder();
    const notebook = notebookWith(api, notify);
    const uncertain = entry("same-id", "2026-11-05T12:00:00.000Z", { title: "Uncertain" });
    handlers.create = () => Promise.reject(failure(500, "no response"));
    handlers.read = (entryId) => {
      expect(entryId).toBe(uncertain.id);
      return Promise.resolve(uncertain);
    };
    notebook.draft.id = uncertain.id;
    notebook.draft.title = uncertain.title;
    notebook.draft.content = uncertain.content;
    expect(await notebook.createEntry()).toBe(uncertain);
    expect(calls.reads).toEqual([uncertain.id]);
    expect(notebook.draft.title).toBe("");

    const conflicting = { ...uncertain, title: "Another GM note" };
    notebook.draft.id = conflicting.id;
    notebook.draft.title = "Second attempt";
    notebook.draft.content = conflicting.content;
    expect(await notebook.createEntry()).toBeNull();
    expect(notebook.draft.title).toBe("Second attempt");
    expect(notices.at(-1)?.title).toBe("Could not create the entry. Your draft is still here.");
  });
});

describe("clearing notebook state", () => {
  it("ignores late responses and empties lists and drafts after dispose", async () => {
    const { api, handlers } = fixture();
    const { notify, notices } = recorder();
    const late = deferred<NotePage>();
    handlers.list = [() => late.promise];
    const notebook = notebookWith(api, notify);
    notebook.refreshRecent();
    notebook.draft.title = "Doomed draft";
    notebook.dispose();
    late.resolve(page([entry("late", "2026-11-05T12:00:00.000Z")], null));
    await Promise.resolve();
    expect(notebook.recent.ids).toEqual([]);
    expect(notebook.browse.ids).toEqual([]);
    expect(notebook.browse.term).toBe("");
    expect(notebook.draft.title).toBe("");
    expect(notices.length).toBe(0);
  });
});
