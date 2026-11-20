import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { noteEmbeddingDimensions } from "./passages.ts";
import { createNoteIndexingScheduler } from "./indexer.ts";
import type { NoteEmbeddings, NoteIndexingEntry, NoteIndexingStore } from "./types.ts";

const gameId = "11111111-1111-4111-8111-111111111111";
const otherGameId = "22222222-2222-4222-8222-222222222222";
const entryId = "33333333-3333-4333-8333-333333333333";
const otherEntryId = "44444444-4444-4444-8444-444444444444";
const key = `${gameId}:${entryId}`;
const vector = Array.from({ length: noteEmbeddingDimensions }, () => 0.25);

const entry = (overrides: Partial<NoteIndexingEntry> = {}): NoteIndexingEntry => ({
  gameId,
  entryId,
  title: "Compass cache",
  content: { ops: [{ insert: "The ferryman accepts a silver compass.\n" }] },
  textFingerprint: "fingerprint-1",
  indexed: false,
  ...overrides,
});

function fakeStore(entries: NoteIndexingEntry[]) {
  const findEntry = vi.fn<NoteIndexingStore["findEntry"]>(async (game, id) => {
    const current = entries.find((row) => row.gameId === game && row.entryId === id);
    return current ? { ...current } : null;
  });
  const passages = new Map<string, unknown[]>();
  const replacePassages = vi.fn<NoteIndexingStore["replacePassages"]>(
    async (game, id, fingerprint, rows) => {
      const current = entries.find((row) => row.gameId === game && row.entryId === id);
      if (!current || current.textFingerprint !== fingerprint) return false;
      passages.set(`${game}:${id}`, rows);
      current.indexed = true;
      return true;
    },
  );
  const findEntriesNeedingIndexing = vi.fn<NoteIndexingStore["findEntriesNeedingIndexing"]>(
    async () =>
      entries
        .filter((row) => !row.indexed)
        .map((row) => ({ gameId: row.gameId, entryId: row.entryId })),
  );
  return {
    store: { findEntry, replacePassages, findEntriesNeedingIndexing } satisfies NoteIndexingStore,
    findEntry,
    replacePassages,
    findEntriesNeedingIndexing,
    passages,
  };
}

const embeddingCall = ["Compass cache\n\nThe ferryman accepts a silver compass."];

describe("note indexing scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("restarts the 60-second cooldown on each text save and then embeds once", async () => {
    const { store, replacePassages, passages } = fakeStore([entry()]);
    const embed = vi.fn<NoteEmbeddings["embed"]>(async (inputs) => inputs.map(() => vector));
    const scheduler = createNoteIndexingScheduler(store, { embed });
    scheduler.schedule(gameId, entryId);
    await vi.advanceTimersByTimeAsync(30_000);
    scheduler.schedule(gameId, entryId);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(embed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed).toHaveBeenCalledWith(embeddingCall);
    expect(replacePassages).toHaveBeenCalledTimes(1);
    expect(replacePassages).toHaveBeenCalledWith(gameId, entryId, "fingerprint-1", [
      { ordinal: 0, text: "The ferryman accepts a silver compass.", embedding: vector },
    ]);
    expect(passages.get(key)).toHaveLength(1);
    scheduler.dispose();
  });

  it("skips embedding when the entry fingerprint is already indexed", async () => {
    const { store } = fakeStore([entry({ indexed: true })]);
    const embed = vi.fn<NoteEmbeddings["embed"]>();
    createNoteIndexingScheduler(store, { embed }).schedule(gameId, entryId);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(embed).not.toHaveBeenCalled();
  });

  it("discards passage results whose entry fingerprint changed during embedding", async () => {
    const current = entry();
    const { store, replacePassages, passages } = fakeStore([current]);
    const embed = vi.fn<NoteEmbeddings["embed"]>(async (inputs) => {
      current.textFingerprint = "fingerprint-2";
      return inputs.map(() => vector);
    });
    createNoteIndexingScheduler(store, { embed }).schedule(gameId, entryId);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(replacePassages).toHaveBeenCalledWith(gameId, entryId, "fingerprint-1", [
      { ordinal: 0, text: "The ferryman accepts a silver compass.", embedding: vector },
    ]);
    expect(await replacePassages.mock.results[0]!.value).toBe(false);
    expect(passages.get(key)).toBeUndefined();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(embed).toHaveBeenCalledTimes(1);
  });

  it("retries failures a bounded number of times, then waits for the next save", async () => {
    const { store, findEntry } = fakeStore([entry()]);
    const embed = vi.fn<NoteEmbeddings["embed"]>(async () => {
      throw Object.assign(new Error("embeddings_unavailable"), { code: "embeddings_unavailable" });
    });
    const scheduler = createNoteIndexingScheduler(store, { embed }, { maxAttempts: 3 });
    scheduler.schedule(gameId, entryId);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(embed).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(embed).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(embed).toHaveBeenCalledTimes(3);
    expect(findEntry).toHaveBeenCalledTimes(3);
    scheduler.schedule(gameId, entryId);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(findEntry).toHaveBeenCalledTimes(4);
  });

  it("treats wrong-dimensional embeddings as failures", async () => {
    const { store, findEntry } = fakeStore([entry()]);
    const embed = vi.fn<NoteEmbeddings["embed"]>(async (inputs) => inputs.map(() => [0.25]));
    const scheduler = createNoteIndexingScheduler(store, { embed }, { maxAttempts: 2 });
    scheduler.schedule(gameId, entryId);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(embed).toHaveBeenCalledTimes(2);
    expect(findEntry).toHaveBeenCalledTimes(2);
  });

  it("sweeps entries with stale fingerprints immediately without touching cooling ones", async () => {
    const cooling = entry();
    const stale = entry({
      gameId: otherGameId,
      entryId: otherEntryId,
      title: "Marsh route",
      content: { ops: [{ insert: "Mira knows a safe path.\n" }] },
    });
    const { store } = fakeStore([cooling, stale]);
    const embed = vi.fn<NoteEmbeddings["embed"]>(async (inputs) => inputs.map(() => vector));
    const scheduler = createNoteIndexingScheduler(store, { embed });
    scheduler.schedule(gameId, entryId);
    await scheduler.sweep();
    await vi.advanceTimersByTimeAsync(0);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed).toHaveBeenCalledWith(["Marsh route\n\nMira knows a safe path."]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(embed).toHaveBeenCalledTimes(2);
    expect(embed).toHaveBeenLastCalledWith(embeddingCall);
    scheduler.dispose();
  });

  it("sweeps nothing when every entry is already indexed", async () => {
    const { store, findEntriesNeedingIndexing } = fakeStore([entry({ indexed: true })]);
    const embed = vi.fn<NoteEmbeddings["embed"]>(async (inputs) => inputs.map(() => vector));
    await createNoteIndexingScheduler(store, { embed }).sweep();
    await vi.advanceTimersByTimeAsync(0);
    expect(findEntriesNeedingIndexing).toHaveBeenCalledTimes(1);
    expect(embed).not.toHaveBeenCalled();
  });

  it("drops pending timers after dispose", async () => {
    const { store } = fakeStore([entry()]);
    const embed = vi.fn<NoteEmbeddings["embed"]>();
    const scheduler = createNoteIndexingScheduler(store, { embed });
    await scheduler.sweep();
    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(embed).not.toHaveBeenCalled();
  });
});
