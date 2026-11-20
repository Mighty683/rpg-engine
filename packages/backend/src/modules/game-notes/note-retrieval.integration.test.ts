import { createGameAccessService } from "../games/service.ts";
import { databaseFromPool } from "../../database/client.ts";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { applyMigrations } from "../../migrations.ts";
import { createGameNotesService } from "./service.ts";
import { createNotePassageStore } from "./passage-store.ts";
import { createNoteIndexingScheduler } from "./indexer.ts";
import { createGameNotesRetrieval, noteSimilarityCutoff } from "./retrieval.ts";
import { noteTextFingerprint } from "./document.ts";
import type { NoteEmbeddings } from "./types.ts";

const url = process.env.TEST_DATABASE_URL;
const schema = `notes_test_${randomUUID().replaceAll("-", "")}`;
const admin = url ? new pg.Pool({ connectionString: url }) : null;
const pool = url
  ? new pg.Pool({ connectionString: url, options: `-c search_path=${schema},public` })
  : null;
const gameId = randomUUID();
const otherGameId = randomUUID();
const gm = { accountId: randomUUID(), sessionId: randomUUID() };
const player = { accountId: randomUUID(), sessionId: randomUUID() };
const stranger = { accountId: randomUUID(), sessionId: randomUUID() };
const membershipId = randomUUID();

/** Unit-norm synthetic vectors; only the first two components vary. */
const unit = (x: number, y: number) => {
  const vector = Array.from({ length: 1024 }, () => 0);
  vector[0] = x;
  vector[1] = y;
  return vector;
};
const queryVector = unit(1, 0);
const signals: Record<string, [number, number]> = {
  aligned: [1, 0],
  near: [0.708, 0.706],
  below: [0.6, 0.8],
  unrelated: [0, 1],
};
/** Embeds the Agent search query into the fixed query direction. */
const queryEmbeddings = {
  embed: vi.fn<NoteEmbeddings["embed"]>(async (_inputs) => [queryVector]),
} satisfies NoteEmbeddings;

const body = (text: string) => ({ ops: [{ insert: `${text}\n` }] });
/** Deterministic-prefix UUID: the suffix comes from randomUUID without dashes. */
const noteUuid = (prefix: string) =>
  `${prefix}-1111-4111-8111-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const noteService = () =>
  createGameNotesService({
    database: databaseFromPool(pool!),
    gameAccessFor: createGameAccessService,
  });

async function createEntry(id: string, title: string, text: string) {
  return noteService().create(gm, gameId, { id, title, content: body(text) });
}

async function fingerprintOf(entryId: string) {
  const result = await pool!.query<{ text_fingerprint: string }>(
    "SELECT text_fingerprint FROM game_note_entries WHERE game_id=$1 AND id=$2",
    [gameId, entryId],
  );
  return result.rows[0]!.text_fingerprint;
}

async function passagesOf(entryIds: string[]) {
  const result = await pool!.query<{ entry_id: string; ordinal: number }>(
    "SELECT entry_id, ordinal FROM game_note_passages WHERE game_id=$1 AND entry_id=ANY($2::uuid[]) ORDER BY entry_id, ordinal",
    [gameId, entryIds],
  );
  return result.rows;
}

describe.skipIf(!url)("game notes agent retrieval", () => {
  let entryIdAligned: string;
  let entryIdNear: string;
  let entryIdLiteral: string;
  let entryIdStale: string;
  let entryIdBelow: string;
  let store: ReturnType<typeof createNotePassageStore>;
  let retrieval: ReturnType<typeof createGameNotesRetrieval>;

  async function passageSet(entryId: string, signal: [number, number], ...texts: string[]) {
    const stored = await store.findEntry(gameId, entryId);
    expect(stored).toMatchObject({ entryId, indexed: false });
    expect(
      await store.replacePassages(
        gameId,
        entryId,
        stored!.textFingerprint,
        texts.map((text, ordinal) => ({ ordinal, text, embedding: unit(...signal) })),
      ),
    ).toBe(true);
  }

  const pollUntil = async (condition: () => Promise<boolean>, ms = 4000) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (await condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };

  beforeAll(async () => {
    await admin!.query(`CREATE SCHEMA "${schema}"`);
    await admin!.query("CREATE EXTENSION IF NOT EXISTS vector");
    await applyMigrations(pool!);
    await pool!.query(
      "INSERT INTO accounts(id,username,password_hash) VALUES ($1,'gm','hash'),($2,'player','hash'),($3,'stranger','hash')",
      [gm.accountId, player.accountId, stranger.accountId],
    );
    for (const [id, gmAccount] of [
      [gameId, gm.accountId],
      [otherGameId, stranger.accountId],
    ] as const)
      await pool!.query(
        "INSERT INTO games(id,name,system_id,gm_account_id) VALUES($1,'Game','fabula-ultima',$2)",
        [id, gmAccount],
      );
    await pool!.query(
      "INSERT INTO players(id,game_id,account_id,name) VALUES ($1,$2,$3,'Player')",
      [membershipId, gameId, player.accountId],
    );
    store = createNotePassageStore(databaseFromPool(pool!));
    retrieval = createGameNotesRetrieval({
      database: databaseFromPool(pool!),
      gameAccessFor: createGameAccessService,
      embeddings: null,
      similarityCutoff: noteSimilarityCutoff,
    });

    entryIdLiteral = noteUuid("11111111");
    entryIdAligned = noteUuid("33333333");
    entryIdNear = noteUuid("55555555");
    entryIdBelow = noteUuid("77777777");
    entryIdStale = noteUuid("99999999");
    await createEntry(entryIdLiteral, "Compass cache", "The ferryman keeps a silver compass.");
    await createEntry(entryIdAligned, "Tower of Bells", "The bells toll at midnight.");
    await createEntry(entryIdNear, "Lantern Road", "Lanterns light the whole road.");
    await createEntry(entryIdBelow, "Marsh ford", "Mira knows a shallow crossing.");
    await createEntry(entryIdStale, "Abandoned mill", "The mill wheel is broken.");
    await passageSet(entryIdLiteral, signals.unrelated, "unrelated passage");
    await passageSet(entryIdAligned, signals.aligned, "aligned passage");
    await passageSet(entryIdNear, signals.near, "near passage one", "near passage two");
    await passageSet(entryIdBelow, signals.below, "below cutoff passage");
    await passageSet(entryIdStale, signals.near, "stale passage");
    // The stale entry's text changes AFTER its passages were written, so its
    // passages are superseded and must never surface in semantic results.
    await noteService().update(gm, gameId, entryIdStale, {
      expectedRevision: 1,
      changes: { content: body("The mill wheel was repaired yesterday.") },
    });
    retrieval = createGameNotesRetrieval({
      database: databaseFromPool(pool!),
      gameAccessFor: createGameAccessService,
      embeddings: queryEmbeddings,
      similarityCutoff: noteSimilarityCutoff,
    });
  });
  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin?.end();
  });

  it("ranks literal matches first, applies the cutoff before semantic ranking, and reports indexing", async () => {
    const outcome = await retrieval.search(gm, gameId, { text: "compass", limit: 5 });
    expect(outcome.matches).toEqual([
      {
        entryId: entryIdLiteral,
        title: "Compass cache",
        excerpt: "The ferryman keeps a silver compass.",
        source: "literal",
      },
      {
        entryId: entryIdAligned,
        title: "Tower of Bells",
        excerpt: "aligned passage",
        source: "semantic",
      },
      {
        entryId: entryIdNear,
        title: "Lantern Road",
        excerpt: "near passage one",
        source: "semantic",
      },
    ]);
    expect(outcome.semanticStatus).toBe("indexing");
    expect(queryEmbeddings.embed).toHaveBeenCalledWith(["compass"], undefined);
  });

  it("preserves at most one match per entry, ranks equal similarity by id, and respects the limit", async () => {
    const outcome = await retrieval.search(gm, gameId, { text: "compass", limit: 3 });
    expect(outcome.matches.map((match) => match.entryId)).toEqual([
      entryIdLiteral,
      entryIdAligned,
      entryIdNear,
    ]);
    const tight = await retrieval.search(gm, gameId, { text: "compass", limit: 1 });
    expect(tight.matches).toEqual([
      {
        entryId: entryIdLiteral,
        title: "Compass cache",
        excerpt: "The ferryman keeps a silver compass.",
        source: "literal",
      },
    ]);
    const noLiteral = await retrieval.search(gm, gameId, { text: "lighthouse beam", limit: 10 });
    expect(noLiteral.matches.map((match) => [match.entryId, match.source])).toEqual([
      [entryIdAligned, "semantic"],
      [entryIdNear, "semantic"],
    ]);
    await expect(passagesOf([entryIdStale])).resolves.toHaveLength(1);
  });

  it("reports ready once every entry fingerprint has matching passages", async () => {
    const staleFingerprint = await fingerprintOf(entryIdStale);
    expect(
      await store.replacePassages(gameId, entryIdStale, staleFingerprint, [
        { ordinal: 0, text: "repaired mill passage", embedding: unit(...signals.unrelated) },
      ]),
    ).toBe(true);
    const outcome = await retrieval.search(gm, gameId, { text: "compass", limit: 5 });
    expect(outcome.semanticStatus).toBe("ready");
  });

  it("still returns literal matches with unavailable semantics when embedding fails or is disabled", async () => {
    const failing = createGameNotesRetrieval({
      database: databaseFromPool(pool!),
      gameAccessFor: createGameAccessService,
      embeddings: {
        embed: vi.fn(async () => {
          throw Object.assign(new Error("embeddings_unavailable"), {
            code: "embeddings_unavailable",
          });
        }),
      },
      similarityCutoff: noteSimilarityCutoff,
    });
    expect(await failing.search(gm, gameId, { text: "compass", limit: 5 })).toEqual({
      matches: [
        {
          entryId: entryIdLiteral,
          title: "Compass cache",
          excerpt: "The ferryman keeps a silver compass.",
          source: "literal",
        },
      ],
      semanticStatus: "unavailable",
    });
    const disabled = createGameNotesRetrieval({
      database: databaseFromPool(pool!),
      gameAccessFor: createGameAccessService,
      embeddings: null,
      similarityCutoff: noteSimilarityCutoff,
    });
    expect((await disabled.search(gm, gameId, { text: "compass", limit: 5 })).semanticStatus).toBe(
      "unavailable",
    );
    const malformed = createGameNotesRetrieval({
      database: databaseFromPool(pool!),
      gameAccessFor: createGameAccessService,
      embeddings: { embed: vi.fn(async () => [[0.5, 0.5]]) },
      similarityCutoff: noteSimilarityCutoff,
    });
    expect((await malformed.search(gm, gameId, { text: "compass", limit: 5 })).semanticStatus).toBe(
      "unavailable",
    );
  });

  it("rechecks current-GM access at execution as a tool error, never an empty result", async () => {
    await expect(
      retrieval.search(player, gameId, { text: "compass", limit: 5 }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      retrieval.search(stranger, gameId, { text: "compass", limit: 5 }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      retrieval.search(gm, randomUUID(), { text: "compass", limit: 5 }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(retrieval.read(player, gameId, [entryIdLiteral])).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("reads full plain-text entries in request order with indistinguishable missing IDs", async () => {
    const otherGameEntry = noteUuid("88888888");
    await createGameNotesService({
      database: databaseFromPool(pool!),
      gameAccessFor: createGameAccessService,
    }).create(stranger, otherGameId, {
      id: otherGameEntry,
      title: "Other game note",
      content: body("A different game's secret text."),
    });
    const missing = "22222222-0000-4000-8000-222222222222";
    const outcome = await retrieval.read(gm, gameId, [
      entryIdNear,
      missing,
      otherGameEntry,
      entryIdLiteral,
    ]);
    expect(outcome.entries).toEqual([
      {
        entryId: entryIdNear,
        title: "Lantern Road",
        text: "Lanterns light the whole road.",
        updatedAt: expect.any(String),
      },
      {
        entryId: entryIdLiteral,
        title: "Compass cache",
        text: "The ferryman keeps a silver compass.",
        updatedAt: expect.any(String),
      },
    ]);
    expect(outcome.missingEntryIds).toEqual([missing, otherGameEntry]);
  });

  it("indexes current saved text after the cooldown, skips indexed fingerprints, and sweeps after restart", async () => {
    const embed = vi.fn<NoteEmbeddings["embed"]>(async (inputs) =>
      inputs.map(() => unit(...signals.unrelated)),
    );
    const indexing = createNoteIndexingScheduler(
      createNotePassageStore(databaseFromPool(pool!)),
      { embed },
      { cooldownMs: 20 },
    );
    const fresh = noteUuid("aaaaaaaa");
    await createEntry(fresh, "Sweep note", "Freshly saved text.");
    indexing.schedule(gameId, fresh);
    await pollUntil(async () => (await passagesOf([fresh])).length > 0);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed).toHaveBeenCalledWith(["Sweep note\n\nFreshly saved text."]);
    const fingerprint = await fingerprintOf(fresh);
    expect(await passagesOf([fresh])).toEqual([{ entry_id: fresh, ordinal: 0 }]);
    expect((await store.findEntry(gameId, fresh))?.indexed).toBe(true);
    // The fingerprint is already indexed: scheduling again must skip embedding.
    indexing.schedule(gameId, fresh);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(embed).toHaveBeenCalledTimes(1);
    const stillFingerprint = await fingerprintOf(fresh);
    expect(stillFingerprint).toBe(fingerprint);
    // A stale entry (superseded passages) is picked up by the startup sweep.
    const stale = noteUuid("cccccccc");
    await createEntry(stale, "Sweep stale", "Changed after saving.");
    await passageSet(stale, signals.near, "old passage text");
    await noteService().update(gm, gameId, stale, {
      expectedRevision: 1,
      changes: { content: body("Changed text while passages were stale.") },
    });
    await indexing.sweep();
    await pollUntil(async () => {
      const rows = await pool!.query<{ text_fingerprint: string; passage_text: string }>(
        "SELECT text_fingerprint, passage_text FROM game_note_passages WHERE game_id=$1 AND entry_id=$2",
        [gameId, stale],
      );
      return rows.rows[0]?.passage_text === "Changed text while passages were stale.";
    });
    expect(await fingerprintOf(stale)).toBe(
      noteTextFingerprint("Sweep stale", body("Changed text while passages were stale.")),
    );
    indexing.dispose();
  });
});
