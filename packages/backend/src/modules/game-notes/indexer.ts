import { noteEmbeddingDimensions, splitNotePassages } from "./passages.ts";
import type {
  NoteEmbeddings,
  NoteIndexingScheduler,
  NoteIndexingStore,
  NotePassageRecord,
} from "./types.ts";

/**
 * In-process indexing scheduler for game note passages. Timers live in
 * memory only (one backend process owns them, like Agent admission) and are
 * lost on restart, where the startup sweep re-arms them. A committed
 * text-changing save starts a 60-second per-note cooldown that each further
 * text save restarts; when it expires the note is embedded only if its
 * fingerprint is not already indexed, and the passage set is replaced only
 * while the entry fingerprint is still the one that was embedded, so
 * superseded results are discarded. A failed run logs a fixed category
 * (never note text, titles, or queries) and retries a bounded number of
 * times before waiting for the next text-changing save or restart. Jobs run
 * one at a time so sweeps never stampede the provider.
 */

const noteIndexingCooldownMs = 60_000;

const invalidResponse = () =>
  Object.assign(new Error("invalid_embedding_response"), { code: "invalid_embedding_response" });

export function createNoteIndexingScheduler(
  store: NoteIndexingStore,
  embeddings: NoteEmbeddings,
  options: { cooldownMs?: number; maxAttempts?: number } = {},
): NoteIndexingScheduler {
  const cooldownMs = options.cooldownMs ?? noteIndexingCooldownMs;
  const maxAttempts = options.maxAttempts ?? 3;
  const timers = new Map<string, NodeJS.Timeout>();
  const failures = new Map<string, number>();
  const queue: string[] = [];
  let draining = false;
  let disposed = false;

  async function index(key: string) {
    const [gameId, entryId] = split(key);
    const entry = await store.findEntry(gameId, entryId);
    if (!entry || entry.indexed) return;
    const passages = splitNotePassages(entry.title, entry.content);
    const vectors = await embeddings.embed(passages.map((passage) => passage.embeddingInput));
    if (vectors.length !== passages.length) throw invalidResponse();
    if (vectors.some((vector) => vector.length !== noteEmbeddingDimensions))
      throw invalidResponse();
    const records: NotePassageRecord[] = passages.map((passage, index) => ({
      ordinal: passage.ordinal,
      text: passage.text,
      embedding: vectors[index]!,
    }));
    await store.replacePassages(gameId, entryId, entry.textFingerprint, records);
  }

  async function run(key: string) {
    try {
      await index(key);
      failures.delete(key);
    } catch (error) {
      const [gameId, entryId] = split(key);
      const code = (error as { code?: string }).code ?? "index_failed";
      const used = (failures.get(key) ?? 0) + 1;
      failures.set(key, used);
      if (used < maxAttempts) arm(key, cooldownMs);
      console.warn("Game note indexing failed", { gameId, entryId, code, used });
    }
  }

  async function drain() {
    while (queue.length) await run(queue.shift()!);
    draining = false;
  }

  function enqueue(key: string) {
    if (!queue.includes(key)) queue.push(key);
    if (!draining && queue.length) {
      draining = true;
      void drain().catch(() => {
        draining = false;
      });
    }
  }

  function arm(key: string, delayMs: number) {
    if (disposed) return;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        enqueue(key);
      }, delayMs),
    );
  }

  return {
    schedule(gameId, entryId) {
      const key = `${gameId}:${entryId}`;
      failures.delete(key);
      arm(key, cooldownMs);
    },
    async sweep() {
      const pending = await store.findEntriesNeedingIndexing();
      for (const { gameId, entryId } of pending) {
        const key = `${gameId}:${entryId}`;
        if (timers.has(key)) continue;
        arm(key, 0);
      }
      console.info("Game notes startup sweep scheduled", { notes: pending.length });
    },
    dispose() {
      disposed = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      queue.length = 0;
    },
  };
}

function split(key: string): [gameId: string, entryId: string] {
  const separator = key.indexOf(":");
  return [key.slice(0, separator), key.slice(separator + 1)];
}
