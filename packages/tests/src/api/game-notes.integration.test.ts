import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createApiFixture, csrfHeaders, readPersistedState, type ApiFixture } from "./fixtures.ts";
import { noteTextFingerprint } from "../../../backend/src/modules/game-notes/document.ts";
import {
  encodeNotePageCursor,
  noteQueryHash,
} from "../../../backend/src/modules/game-notes/cursor.ts";
import type {
  AgentCompletion,
  AgentProvider,
  AgentToolName,
} from "../../../backend/src/modules/agent/types.ts";
import type { NoteEmbeddings } from "../../../backend/src/modules/game-notes/types.ts";

const url = process.env.TEST_DATABASE_URL;

type ApiEntry = {
  id: string;
  title: string;
  content: { ops: { insert: string; attributes?: Record<string, unknown> }[] };
  createdAt: string;
  updatedAt: string;
  revision: number;
};

/**
 * Adversarial API checks for game notes: access-first 403/404 handling, cursor
 * paging, literal search, canonical document storage, optimistic concurrency,
 * write guards, and note-payload privacy in events. API-07 drives the Agent
 * note tools through the real turn endpoint with deterministic providers.
 */
describe.skipIf(!url)("Game notes API", () => {
  let fixture: ApiFixture;
  const complete = vi.fn<AgentProvider["complete"]>();
  const finish = (text: string = "Done with notes."): AgentCompletion => ({
    text,
    calls: [],
    inputTokens: 100,
    outputTokens: 10,
  });
  const tool = (name: AgentToolName, args: unknown): AgentCompletion => ({
    ...finish(""),
    calls: [{ id: "call00001", name, arguments: JSON.stringify(args) }],
  });
  /** Synthetic 1024-dimensional unit vectors aligned on the first two axes. */
  const direction = (x: number, y: number) => {
    const vector = Array.from({ length: 1024 }, () => 0);
    vector[0] = x;
    vector[1] = y;
    return vector;
  };
  const queryDirection = direction(1, 0);
  const vectorLiteral = (vector: readonly number[]) => `[${vector.join(",")}]`;
  const embedNotes = vi.fn<NoteEmbeddings["embed"]>(async (inputs) =>
    inputs.map(() => queryDirection),
  );
  beforeAll(async () => {
    fixture = await createApiFixture("game_notes", {
      appOrigin: "http://allowed.example",
      application: {
        mutationLimits: { limit: 10_000, windowMs: 60_000 },
        agentProvider: { complete },
        // Deterministic query embedding; passages are seeded with matching
        // vectors below, so semantic ranking is reproducible without a key.
        noteEmbeddings: { embed: (inputs, signal) => embedNotes(inputs, signal) },
      },
    });
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  const notesPath = () => `/games/${fixture.ids.game}/notes`;
  const foreignNotesPath = () => `/games/${fixture.ids.otherGame}/notes`;
  const allowedOrigin = "http://allowed.example";

  const documentOf = (text: string) => ({
    ops: [{ insert: text.endsWith("\n") ? text : `${text}\n` }],
  });

  async function createNote(
    title: string,
    content: unknown = documentOf("Plain body"),
    path = notesPath(),
    actor = "gm",
  ) {
    const id = randomUUID();
    const response = await fixture.request(path, actor, "POST", { id, title, content });
    expect(response.status, `create ${title}`).toBe(201);
    const { entry } = (await response.json()) as { entry: ApiEntry };
    expect(entry.id).toBe(id);
    return entry;
  }

  async function noteRows(gameId = fixture.ids.game) {
    const result = await fixture.pool.query(
      "SELECT id, title, content, text_fingerprint, revision FROM game_note_entries WHERE game_id=$1 ORDER BY id",
      [gameId],
    );
    return result.rows;
  }

  async function fullRow(entryId: string, gameId = fixture.ids.game) {
    const result = await fixture.pool.query(
      `SELECT title, content, text_fingerprint, revision,
        (extract(epoch from created_at) * 1000000)::bigint AS created_micros,
        (extract(epoch from updated_at) * 1000000)::bigint AS updated_micros
       FROM game_note_entries WHERE game_id=$1 AND id=$2`,
      [gameId, entryId],
    );
    expect(result.rows).toHaveLength(1);
    return result.rows[0] as {
      title: string;
      content: { ops: unknown[] };
      text_fingerprint: string;
      revision: number;
      created_micros: string;
      updated_micros: string;
    };
  }

  async function listPage(query: string, actor = "gm", path = notesPath()) {
    const response = await fixture.request(`${path}${query}`, actor);
    expect(response.status, `list ${query} as ${actor}`).toBe(200);
    return (await response.json()) as { entries: ApiEntry[]; nextCursor: string | null };
  }

  it("API-01 rejects anonymous, unknown, and player actors first and persists no note", async () => {
    const path = notesPath();
    const entryId = randomUUID();
    const patched = { expectedRevision: 1, changes: { title: "Forged" } };
    const created = { id: randomUUID(), title: "Forged", content: documentOf("Forged body") };
    expect((await fixture.request(path, null)).status).toBe(401);
    expect((await fixture.request(`${path}/${entryId}`, null)).status).toBe(401);
    expect((await fixture.request(path, null, "POST", created)).status).toBe(401);
    expect((await fixture.request(`${path}/${entryId}`, null, "PATCH", patched)).status).toBe(401);
    expect(
      (await fixture.request(`${path}/${entryId}`, "invalid-session", "PATCH", patched)).status,
    ).toBe(401);

    const hidden = { error: { code: "ERR01" } };
    for (const gamePath of [path, `${path}/${entryId}`]) {
      const outsider = await fixture.request(gamePath, "outsider");
      expect(outsider.status).toBe(404);
      expect(await outsider.json()).toEqual(hidden);
      const stranger = await fixture.request(
        gamePath.replace(fixture.ids.game, randomUUID()),
        "outsider",
      );
      expect(stranger.status).toBe(404);
      expect(await stranger.json()).toEqual(hidden);
    }
    expect((await fixture.request(path, "outsider", "POST", created)).status).toBe(404);
    expect((await fixture.request(`${path}/${entryId}`, "outsider", "PATCH", patched)).status).toBe(
      404,
    );

    const forbidden = { error: { code: "ERR82" } };
    for (const gamePath of [path, `${path}/${entryId}`]) {
      const player = await fixture.request(gamePath, "player");
      expect(player.status).toBe(403);
      expect(await player.json()).toEqual(forbidden);
    }
    expect((await fixture.request(path, "player", "POST", created)).status).toBe(403);
    expect((await fixture.request(`${path}/${entryId}`, "player", "PATCH", patched)).status).toBe(
      403,
    );

    await createNote("Other game entry", documentOf("Other body"), foreignNotesPath(), "outsider");
    const missing = await fixture.request(`${path}/${randomUUID()}`, "gm");
    const foreign = await fixture.request(`${path}/${randomUUID()}`, "gm");
    expect(missing.status).toBe(404);
    expect(foreign.status).toBe(404);
    expect(await missing.json()).toEqual(await foreign.json());

    const beforeRevoke = await readPersistedState(fixture);
    await fixture.pool.query("UPDATE players SET removed = true WHERE id = $1", [
      fixture.ids.member,
    ]);
    for (const revokedPath of [path, `${path}/${entryId}`]) {
      const response = await fixture.request(revokedPath, "player");
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(hidden);
    }
    expect((await fixture.request(path, "player", "POST", created)).status).toBe(404);
    expect((await fixture.request(`${path}/${entryId}`, "player", "PATCH", patched)).status).toBe(
      404,
    );
    await fixture.pool.query("UPDATE players SET removed = false WHERE id = $1", [
      fixture.ids.member,
    ]);
    expect((await fixture.request(path, "player")).status).toBe(403);
    expect(await noteRows()).toEqual([]);
    expect(await noteRows(fixture.ids.otherGame)).toHaveLength(1);
    expect(await readPersistedState(fixture)).toEqual(beforeRevoke);
  });

  it("API-02 pages stably, scopes cursors, and searches title and body before paging", async () => {
    const path = notesPath();
    for (const index of [1, 2, 3])
      await createNote(`Plain entry ${index}`, documentOf(`Nothing special in entry ${index}`));
    for (let index = 1; index <= 22; index++)
      await createNote(`Sigil note ${index}`, documentOf(`The sigil ${index} is carved in stone`));

    const firstPage = await listPage("");
    expect(firstPage.entries).toHaveLength(20);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(firstPage.entries.map((entry) => entry.title)).toEqual(
      Array.from({ length: 20 }, (_value, index) => `Sigil note ${22 - index}`),
    );
    const secondPage = await listPage(`?cursor=${firstPage.nextCursor}`);
    expect(secondPage.nextCursor).toBeNull();
    const allEntries = [...firstPage.entries, ...secondPage.entries];
    expect(new Set(allEntries.map((entry) => entry.id)).size).toBe(25);
    expect(allEntries.map((entry) => entry.title)).toEqual([
      ...Array.from({ length: 22 }, (_value, index) => `Sigil note ${22 - index}`),
      "Plain entry 3",
      "Plain entry 2",
      "Plain entry 1",
    ]);
    const blankQuery = await listPage("?q=%20%20");
    expect(blankQuery.entries[0]!.id).toBe(firstPage.entries[0]!.id);
    expect(blankQuery.nextCursor).toBe(firstPage.nextCursor);

    const plainSearch = await listPage("?q=plain%20entry");
    expect(plainSearch.entries.map((entry) => entry.title)).toEqual([
      "Plain entry 3",
      "Plain entry 2",
      "Plain entry 1",
    ]);
    expect(plainSearch.nextCursor).toBeNull();
    const sigilFirst = await listPage("?q=Sigil");
    expect(sigilFirst.entries).toHaveLength(20);
    const sigilRest = await listPage(`?q=Sigil&cursor=${sigilFirst.nextCursor}`);
    expect(sigilRest.entries).toHaveLength(2);
    expect(sigilRest.nextCursor).toBeNull();
    const sigilIds = sigilFirst.entries.map((entry) => entry.id);
    expect(new Set([...sigilIds, ...sigilRest.entries.map((entry) => entry.id)]).size).toBe(22);
    for (const plain of plainSearch.entries) expect(sigilIds).not.toContain(plain.id);
    // Cursors bind the exact trimmed query, so another spelling is another query's cursor.
    expect(
      (await fixture.request(`${path}?q=SIGIL&cursor=${sigilFirst.nextCursor}`, "gm")).status,
    ).toBe(400);

    const craftedForeign = encodeNotePageCursor(
      { id: randomUUID(), micros: "1234567890123" },
      { gameId: fixture.ids.otherGame, queryHash: noteQueryHash(null) },
    );
    expect((await fixture.request(`${path}?q=&cursor=${craftedForeign}`, "gm")).status).toBe(400);
    const foreignEntry = (await noteRows(fixture.ids.otherGame))[0]!;
    const craftedOtherGame = encodeNotePageCursor(
      { id: foreignEntry.id, micros: "1234567890123" },
      { gameId: fixture.ids.otherGame, queryHash: noteQueryHash("other") },
    );
    expect((await fixture.request(`${path}?q=other&cursor=${craftedOtherGame}`, "gm")).status).toBe(
      400,
    );
    expect((await fixture.request(`${path}?cursor=${sigilFirst.nextCursor}`, "gm")).status).toBe(
      400,
    );
    expect(
      (await fixture.request(`${path}?q=Sigil&cursor=${firstPage.nextCursor}`, "gm")).status,
    ).toBe(400);
    expect((await fixture.request(`${path}?cursor=garbage`, "gm")).status).toBe(400);
    expect(
      (await fixture.request(`${path}?cursor=${encodeURIComponent("@! not a cursor")}`, "gm"))
        .status,
    ).toBe(400);

    await createNote("Ferryman title", documentOf("A quiet crossing"));
    const formattedEntry = await createNote("Formatting crossing", {
      ops: [
        { insert: "Ferry", attributes: { bold: true } },
        { insert: "man", attributes: { italic: true } },
        { insert: " charges gold" },
        { insert: "\n" },
      ],
    });
    const crossing = await listPage("?q=FERRYMAN");
    expect(crossing.entries.map((entry) => entry.id)).toContain(formattedEntry.id);
    const titleCase = await listPage("?q=ferryman%20title");
    expect(titleCase.entries.map((entry) => entry.title)).toContain("Ferryman title");

    await createNote("Sale sign", documentOf("Everything 50%_off today"));
    const sale = await listPage("?q=50%25_off");
    expect(sale.entries.map((entry) => entry.title)).toEqual(["Sale sign"]);
    expect((await listPage("?q=50loff")).entries).toEqual([]);
    expect((await listPage("?q=50_")).entries).toEqual([]);

    const twoLines = await createNote("Two lines", documentOf("beta\ngamma"));
    const multiline = await listPage("?q=beta%0Agamma");
    expect(multiline.entries.map((entry) => entry.id)).toEqual([twoLines.id]);
  });

  it("API-03 creates canonical entries and rejects duplicates, malformed, and oversized input", async () => {
    const path = notesPath();
    const initialCount = (await noteRows()).length;
    const id = randomUUID();
    const created = await fixture.request(path, "gm", "POST", {
      id,
      title: "  The ferryman's price  ",
      content: {
        ops: [
          { insert: "Ferry", attributes: { bold: true } },
          { insert: "man", attributes: { bold: true } },
          { insert: "charges\n", attributes: {} },
        ],
      },
    });
    expect(created.status).toBe(201);
    const { entry } = (await created.json()) as { entry: ApiEntry };
    expect(entry).toMatchObject({
      id,
      title: "The ferryman's price",
      revision: 1,
      content: {
        ops: [{ insert: "Ferryman", attributes: { bold: true } }, { insert: "charges\n" }],
      },
    });
    expect(entry.updatedAt).toBe(entry.createdAt);
    const row = await fullRow(id);
    expect(row.content).toEqual(entry.content);
    expect(row.title).toBe("The ferryman's price");
    expect(row.revision).toBe(1);
    expect(row.text_fingerprint).toBe(noteTextFingerprint("The ferryman's price", entry.content));
    expect(await noteRows()).toHaveLength(initialCount + 1);

    const beforeDuplicate = await fullRow(id);
    const repeat = await fixture.request(path, "gm", "POST", {
      id,
      title: "The ferryman's price",
      content: entry.content,
    });
    expect(repeat.status).toBe(409);
    expect(await repeat.json()).toMatchObject({ error: { code: "ERR01" } });
    const conflicting = await fixture.request(path, "gm", "POST", {
      id,
      title: "A different story",
      content: documentOf("Different body"),
    });
    expect(conflicting.status).toBe(409);
    expect(await fullRow(id)).toEqual(beforeDuplicate);

    const beforeRejected = await noteRows();
    const validTitle = "Valid entry";
    // Unknown fields, unsupported operations, and unsupported formats return 400.
    const badRequests: [unknown, string][] = [
      [
        { id: randomUUID(), title: validTitle, content: documentOf("ok"), systemId: "fabula" },
        "unknown envelope field",
      ],
      [{ title: validTitle, content: documentOf("ok") }, "missing id"],
      [{ id: randomUUID(), content: documentOf("ok") }, "missing title"],
      [{ id: "not-a-uuid", title: validTitle, content: documentOf("ok") }, "bad id format"],
      [{ id: randomUUID(), title: validTitle }, "missing content"],
      [
        {
          id: randomUUID(),
          title: validTitle,
          content: { ops: [{ retain: 1 }, { insert: "\n" }] },
        },
        "retained op",
      ],
      [
        {
          id: randomUUID(),
          title: validTitle,
          content: { ops: [{ delete: 1 }, { insert: "\n" }] },
        },
        "deleted op",
      ],
      [
        { id: randomUUID(), title: validTitle, content: { ops: [{ insert: { image: "x" } }] } },
        "embedded insert",
      ],
      [
        {
          id: randomUUID(),
          title: validTitle,
          content: { ops: [{ insert: "" }, { insert: "\n" }] },
        },
        "empty insert",
      ],
      [{ id: randomUUID(), title: validTitle, content: { ops: [] } }, "empty ops"],
      [{ id: randomUUID(), title: validTitle, content: {} }, "missing ops"],
      [
        { id: randomUUID(), title: validTitle, content: { ops: [{ insert: "a", forged: 1 }] } },
        "unknown op field",
      ],
      [
        {
          id: randomUUID(),
          title: validTitle,
          content: { ops: [{ insert: "a", attributes: { color: "red" } }, { insert: "\n" }] },
        },
        "unknown attribute",
      ],
      [
        {
          id: randomUUID(),
          title: validTitle,
          content: { ops: [{ insert: "a", attributes: { bold: "yes" } }, { insert: "\n" }] },
        },
        "wrong attribute value",
      ],
    ];
    // Placement, terminal-newline, and document-limit violations return 422.
    const invalidValues: [unknown, string][] = [
      [{ id: randomUUID(), title: "", content: documentOf("ok") }, "blank title"],
      [{ id: randomUUID(), title: "y".repeat(161), content: documentOf("ok") }, "overlong title"],
      [
        { id: randomUUID(), title: validTitle, content: { ops: [{ insert: "text" }] } },
        "missing terminal newline",
      ],
      [
        {
          id: randomUUID(),
          title: validTitle,
          content: { ops: [{ insert: "a\n", attributes: { bold: true } }] },
        },
        "inline attributes on a newline insert",
      ],
      [
        {
          id: randomUUID(),
          title: validTitle,
          content: { ops: [{ insert: "\n", attributes: { header: 2, list: "bullet" } }] },
        },
        "header and list on one line",
      ],
      [
        {
          id: randomUUID(),
          title: validTitle,
          content: { ops: [{ insert: "text", attributes: { header: 1 } }, { insert: "\n" }] },
        },
        "header on a text insert",
      ],
      [
        {
          id: randomUUID(),
          title: validTitle,
          content: { ops: [{ insert: `${"—".repeat(5001)}\n` }] },
        },
        "body over 5,000 code points",
      ],
      [
        {
          id: randomUUID(),
          title: validTitle,
          content: {
            ops: Array.from(
              { length: 1600 },
              (_value, index): { insert: string; attributes?: Record<string, unknown> } => ({
                insert: index % 2 ? "1" : "0",
                attributes: index % 2 ? { italic: true } : { bold: true },
              }),
            ).concat({ insert: "\n" }),
          },
        },
        "normalized body over 64 KiB",
      ],
    ];
    for (const [body, name] of [...badRequests, ...invalidValues]) {
      const response = await fixture.request(path, "gm", "POST", body);
      const expected = badRequests.find(([candidate]) => candidate === body) ? 400 : 422;
      expect(response.status, name).toBe(expected);
      expect(await response.json()).toMatchObject({
        error: { code: expected === 400 ? "ERR80" : "ERR84" },
      });
    }
    const oversized = await fixture.request(path, "gm", "POST", {
      id: randomUUID(),
      title: validTitle,
      content: { ops: [{ insert: "x".repeat(97 * 1024) }] },
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toMatchObject({ error: { code: "ERR87" } });
    expect(await noteRows()).toEqual(beforeRejected);
  });

  it("API-04 returns stored normalized entries by ID only to the GM", async () => {
    const path = notesPath();
    const entry = await createNote("Parsable entry", {
      ops: [
        { insert: "Heading" },
        { insert: "\n", attributes: { header: 1 } },
        { insert: "Body" },
        { insert: "\n" },
      ],
    });
    const read = await fixture.request(`${path}/${entry.id}`, "gm");
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({ entry });
    const independent = await fixture.request(`${path}/${entry.id}?q=unrelated`, "gm");
    expect(await independent.json()).toEqual({ entry });
    expect((await fixture.request(`${path}/${randomUUID()}`, "gm")).status).toBe(404);
    expect((await fixture.request(`${path}/${entry.id}`, "outsider")).status).toBe(404);
    expect((await fixture.request(`${path}/${entry.id}`, "player")).status).toBe(403);
    expect((await fixture.request(`${path}/${entry.id}`, null)).status).toBe(401);
    const row = await fullRow(entry.id);
    expect(row.content).toEqual(entry.content);
    expect(row.text_fingerprint).toBe(noteTextFingerprint(entry.title, entry.content));
  });

  it("API-05 guards revisions, no-ops, and fingerprints on saves", async () => {
    const path = notesPath();
    const entry = await createNote("Session plan", documentOf("Original plan for the gala"));
    const createdRow = await fullRow(entry.id);

    const retitle = await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
      expectedRevision: 1,
      changes: { title: "Gala protocol" },
    });
    expect(retitle.status).toBe(200);
    const retitled = ((await retitle.json()) as { entry: ApiEntry }).entry;
    expect(retitled.title).toBe("Gala protocol");
    expect(retitled.revision).toBe(2);
    expect(retitled.createdAt).toBe(entry.createdAt);
    const retitledRow = await fullRow(entry.id);
    expect(retitledRow.created_micros).toBe(createdRow.created_micros);
    expect(Number(retitledRow.updated_micros)).toBeGreaterThan(Number(createdRow.created_micros));
    expect(retitledRow.text_fingerprint).toBe(noteTextFingerprint("Gala protocol", entry.content));

    const staleBefore = await fullRow(entry.id);
    const stale = await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
      expectedRevision: 1,
      changes: { title: "Should not apply" },
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: { code: "ERR01" } });
    expect(await fullRow(entry.id)).toEqual(staleBefore);

    const noOp = await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
      expectedRevision: 2,
      changes: { title: " Gala protocol " },
    });
    expect(noOp.status).toBe(200);
    const noOpEntry = ((await noOp.json()) as { entry: ApiEntry }).entry;
    expect(noOpEntry.revision).toBe(2);
    expect(noOpEntry.updatedAt).toBe(retitled.updatedAt);
    const contentNoOp = await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
      expectedRevision: 2,
      changes: {
        content: {
          ops: [{ insert: "Original" }, { insert: " plan for the gala" }, { insert: "\n" }],
        },
      },
    });
    expect(contentNoOp.status).toBe(200);
    expect(((await contentNoOp.json()) as { entry: ApiEntry }).entry.revision).toBe(2);
    expect(await fullRow(entry.id)).toEqual(staleBefore);

    const textChange = await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
      expectedRevision: 2,
      changes: { title: "Gala aftermath", content: documentOf("The gala ended in a theft") },
    });
    expect(textChange.status).toBe(200);
    const textEntry = ((await textChange.json()) as { entry: ApiEntry }).entry;
    expect(textEntry.revision).toBe(3);
    expect(textEntry.createdAt).toBe(entry.createdAt);
    const textRow = await fullRow(entry.id);
    expect(textRow.text_fingerprint).toBe(noteTextFingerprint("Gala aftermath", textEntry.content));
    expect(textRow.text_fingerprint).not.toBe(staleBefore.text_fingerprint);

    const formattingOnly = await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
      expectedRevision: 3,
      changes: {
        content: {
          ops: [
            { insert: "The " },
            { insert: "gala", attributes: { bold: true } },
            { insert: " ended in a theft\n" },
          ],
        },
      },
    });
    expect(formattingOnly.status).toBe(200);
    const formattedEntry = ((await formattingOnly.json()) as { entry: ApiEntry }).entry;
    expect(formattedEntry.revision).toBe(4);
    expect(formattedEntry.createdAt).toBe(entry.createdAt);
    const formattedRow = await fullRow(entry.id);
    expect(formattedRow.text_fingerprint).toBe(textRow.text_fingerprint);
    expect(Number(formattedRow.updated_micros)).toBeGreaterThan(Number(textRow.updated_micros));

    const beforeBadPatches = await fullRow(entry.id);
    expect(
      (await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", { changes: { title: "x" } }))
        .status,
    ).toBe(400);
    expect(
      (
        await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
          expectedRevision: 4,
          changes: {},
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
          expectedRevision: 4,
          changes: { heading: "x" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
          expectedRevision: "4",
          changes: { title: "x" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
          expectedRevision: 4,
          changes: { title: "x" },
          owner: "forged",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fixture.request(`${path}/${randomUUID()}`, "gm", "PATCH", {
          expectedRevision: 1,
          changes: { title: "x" },
        })
      ).status,
    ).toBe(404);
    const bothInvalid = await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
      expectedRevision: 4,
      changes: {
        title: "",
        content: { ops: [{ insert: "text", attributes: { header: 1 } }, { insert: "\n" }] },
      },
    });
    expect(bothInvalid.status).toBe(422);
    expect(
      Object.keys(
        ((await bothInvalid.json()) as { error: { fields: Record<string, unknown> } }).error.fields,
      ).sort(),
    ).toEqual(["content", "title"]);
    const oversizedPatch = await fixture.request(`${path}/${entry.id}`, "gm", "PATCH", {
      expectedRevision: 4,
      changes: { title: "x".repeat(97 * 1024) },
    });
    expect(oversizedPatch.status).toBe(413);
    await expect(fullRow(entry.id)).resolves.toEqual(beforeBadPatches);
  });

  it("API-06 keeps write guards and never leaks note payloads into events", async () => {
    const path = notesPath();
    const entryId = randomUUID();
    const sessionCookie = `rpg_session=${fixture.tokens.gm}`;
    const created = await fixture.request(path, "gm", "POST", {
      id: entryId,
      title: "Riddle of the amber lock",
      content: documentOf("the lock hums under moonlight"),
    });
    expect(created.status).toBe(201);
    expect(
      (
        await fixture.request(path, null, "POST", {
          id: randomUUID(),
          title: "Unsigned",
          content: documentOf("nope"),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fixture.request(`${path}/${entryId}`, null, "PATCH", {
          expectedRevision: 1,
          changes: { title: "Unsigned" },
        })
      ).status,
    ).toBe(401);

    const target = `${fixture.origin}/api${path}/${entryId}`;
    const patchBody = JSON.stringify({ expectedRevision: 1, changes: { title: "No token" } });
    const noCsrf = await fetch(target, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: sessionCookie, origin: allowedOrigin },
      body: patchBody,
    });
    expect(noCsrf.status).toBe(403);
    expect(await noCsrf.json()).toMatchObject({ error: { code: "ERR85" } });
    const playerBound = await csrfHeaders(fixture.origin, `rpg_session=${fixture.tokens.player}`);
    const mismatched = await fetch(target, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...playerBound,
        cookie: `${sessionCookie}; ${playerBound.cookie}`,
        origin: allowedOrigin,
      },
      body: patchBody,
    });
    expect(mismatched.status).toBe(403);
    expect(await mismatched.json()).toMatchObject({ error: { code: "ERR85" } });
    for (const badOrigin of [null, "https://evil.example"]) {
      const hostile = await fetch(target, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(badOrigin ? { origin: badOrigin } : {}),
        },
        body: patchBody,
      });
      expect(hostile.status).toBe(403);
    }
    expect(
      (
        await fixture.request(
          path,
          "gm",
          "POST",
          { id: randomUUID(), title: "Hostile", content: documentOf("denied") },
          "https://evil.example",
        )
      ).status,
    ).toBe(403);
    const beforeWrites = await fullRow(entryId);

    const streamControllers = [new AbortController(), new AbortController()];
    const streams = await Promise.all(
      ["gm", "player"].map((actor, index) =>
        fetch(`${fixture.origin}/api/games/${fixture.ids.game}/events`, {
          headers: { cookie: `rpg_session=${fixture.tokens[actor]}` },
          signal: streamControllers[index]!.signal,
        }),
      ),
    );
    const readers = streams.map((stream) => stream.body!.getReader());
    await Promise.all(readers.map((reader) => reader.read()));
    await createNote("Moonlit confession", documentOf("the ferryman hides a lantern"));
    await fixture.request(`${path}/${entryId}`, "gm", "PATCH", {
      expectedRevision: 1,
      changes: { title: "Amber hums" },
    });
    await fixture.request(`${path}?q=amber%20lock`, "gm");
    const npcResponse = await fixture.request(`/games/${fixture.ids.game}/npcs`, "gm", "POST", {
      id: randomUUID(),
      npc: {
        name: "Bridgekeeper",
        relationship: "neutral",
        level: 5,
        visibility: "hidden",
        baseDice: { DEX: 6, INS: 6, MIG: 6, WLP: 6 },
        hp: { current: 1, max: 1 },
        mp: { current: 1, max: 1 },
        defense: 6,
        magicDefense: 6,
        attacks: [],
        notes: "",
      },
    });
    expect(npcResponse.status).toBe(201);
    for (const reader of readers) {
      const frame = new TextDecoder().decode((await reader.read()).value);
      expect(frame).toBe('data: {"type":"npcs"}\n\n');
      expect(frame).not.toContain("amber");
      expect(frame).not.toContain("ferryman");
    }
    const writtenRow = await fullRow(entryId);
    expect(writtenRow.title).toBe("Amber hums");
    expect(writtenRow.revision).toBe(2);
    expect(Number(writtenRow.updated_micros)).toBeGreaterThan(Number(beforeWrites.updated_micros));
    expect(writtenRow.text_fingerprint).toBe(
      noteTextFingerprint("Amber hums", { ops: [{ insert: "the lock hums under moonlight\n" }] }),
    );
    streamControllers.forEach((controller) => controller.abort());
  });

  it("API-07 serves search_notes and get_notes through the Agent turn endpoint", async () => {
    complete.mockReset().mockResolvedValue(finish());
    embedNotes.mockClear();
    // A dedicated game keeps every fingerprint in the status join deliberate.
    const turnGame = randomUUID();
    await fixture.pool.query(
      "INSERT INTO games(id,name,system_id,gm_account_id) VALUES($1,'Notes turn game','fabula-ultima',$2)",
      [turnGame, fixture.ids.gm],
    );
    const turnNotesPath = `/games/${turnGame}/notes`;
    const noteEntry = async (title: string, text: string) =>
      createNote(title, documentOf(text), turnNotesPath);
    const eLiteral = await noteEntry(
      "Ferryman contract",
      "The ferryman takes ten zenit at the dawn crossing.",
    );
    const eAligned = await noteEntry("Lighthouse ledger", "The keeper counts candles.");
    const eBelow = await noteEntry("Weather journal", "Nothing about crossings here.");
    const eStale = await noteEntry("Abandoned mill", "The wheel turned.");

    const storedFingerprint = async (entryId: string) =>
      String(
        (
          await fixture.pool.query(
            "SELECT text_fingerprint FROM game_note_entries WHERE game_id=$1 AND id=$2",
            [turnGame, entryId],
          )
        ).rows[0].text_fingerprint,
      );

    /** Replaces one entry's passage set with the given synthetic vectors. */
    const seedPassages = async (
      entry: ApiEntry,
      rows: { text: string; vector: number[]; fingerprint?: string }[],
    ) => {
      await fixture.pool.query("DELETE FROM game_note_passages WHERE game_id=$1 AND entry_id=$2", [
        turnGame,
        entry.id,
      ]);
      const fingerprint = await storedFingerprint(entry.id);
      for (const [ordinal, row] of rows.entries())
        await fixture.pool.query(
          "INSERT INTO game_note_passages(game_id,entry_id,ordinal,text_fingerprint,passage_text,embedding) VALUES($1,$2,$3,$4,$5,$6::vector)",
          [
            turnGame,
            entry.id,
            ordinal,
            row.fingerprint ?? fingerprint,
            row.text,
            vectorLiteral(row.vector),
          ],
        );
    };

    const aligned = direction(1, 0);
    const belowCutoff = direction(0.6, 0.8);
    await seedPassages(eAligned, [{ text: "the lamp room glows", vector: aligned }]);
    await seedPassages(eBelow, [{ text: "below the cliff path", vector: belowCutoff }]);
    await seedPassages(eStale, [{ text: "old mill song", vector: aligned }]);
    // A text-changing save leaves the stale entry's passages superseded.
    const restock = await fixture.request(`${turnNotesPath}/${eStale.id}`, "gm", "PATCH", {
      expectedRevision: 1,
      changes: { content: documentOf("The wheel was repaired.") },
    });
    expect(restock.status).toBe(200);

    const resetAgentWindow = () =>
      fixture.pool.query(
        "UPDATE sign_in_attempts SET window_started_at=now()-interval '2 minutes'",
      );
    const sendTurn = async (arg: { message: string }, game: string = turnGame, actor = "gm") => {
      await resetAgentWindow();
      return fixture.request(`/games/${game}/agent/turns`, actor, "POST", arg);
    };
    /** The tool outcome the provider received last, as JSON. */
    const lastToolOutcome = () => {
      const last = complete.mock.calls.at(-1)![0].messages.at(-1)!;
      if (last.role !== "tool") throw new Error("Expected a tool result message");
      return JSON.parse(last.content) as Record<string, unknown>;
    };

    // Literally matched, trimmed query; literal first, deduped against the
    // semantic matches for the same entry, and superseded or below-cutoff
    // passages never fill the remaining slots.
    complete
      .mockResolvedValueOnce(tool("search_notes", { query: "  ferryman  " }))
      .mockResolvedValueOnce(finish("Cited from the notebook."));
    expect((await sendTurn({ message: "First question" })).status).toBe(200);
    expect(lastToolOutcome()).toEqual({
      matches: [
        {
          entryId: eLiteral.id,
          title: "Ferryman contract",
          excerpt: "The ferryman takes ten zenit at the dawn crossing.",
          source: "literal",
        },
        {
          entryId: eAligned.id,
          title: "Lighthouse ledger",
          excerpt: "the lamp room glows",
          source: "semantic",
        },
      ],
      semanticStatus: "indexing",
    });

    // Semantic-only query: superseded and below-cutoff passages never fill slots.
    complete
      .mockResolvedValueOnce(tool("search_notes", { query: "lamp room", limit: 5 }))
      .mockResolvedValueOnce(finish());
    expect((await sendTurn({ message: "Second question" })).status).toBe(200);
    expect(lastToolOutcome()).toEqual({
      matches: [
        {
          entryId: eAligned.id,
          title: "Lighthouse ledger",
          excerpt: "the lamp room glows",
          source: "semantic",
        },
      ],
      semanticStatus: "indexing",
    });

    // At most one match per entry, literal first, and the shared limit caps the
    // list; the literal entry's own similar passage must not duplicate it.
    await seedPassages(eLiteral, [{ text: "the toll pays at dawn", vector: aligned }]);
    complete
      .mockResolvedValueOnce(tool("search_notes", { query: "zenit", limit: 2 }))
      .mockResolvedValueOnce(finish());
    expect((await sendTurn({ message: "Third question" })).status).toBe(200);
    const limited = lastToolOutcome() as { matches: { entryId: string; source: string }[] };
    expect(limited.matches).toHaveLength(2);
    expect(limited.matches[0]).toEqual({
      entryId: eLiteral.id,
      title: "Ferryman contract",
      excerpt: "The ferryman takes ten zenit at the dawn crossing.",
      source: "literal",
    });
    expect(limited.matches[1]!.source).toBe("semantic");
    expect([eAligned.id, eLiteral.id]).toContain(limited.matches[1]!.entryId);

    // Once every entry fingerprint has passages, the status settles to ready.
    await seedPassages(eStale, [{ text: "repaired wheel passage", vector: belowCutoff }]);
    complete
      .mockResolvedValueOnce(tool("search_notes", { query: "zenit", limit: 10 }))
      .mockResolvedValueOnce(finish());
    expect((await sendTurn({ message: "Fourth question" })).status).toBe(200);
    const ready = lastToolOutcome() as { semanticStatus: string; matches: unknown[] };
    expect(ready.semanticStatus).toBe("ready");

    // A failed query embedding still returns every literal match.
    embedNotes.mockRejectedValueOnce(
      Object.assign(new Error("embeddings_unavailable"), { code: "embeddings_unavailable" }),
    );
    complete
      .mockResolvedValueOnce(tool("search_notes", { query: "zenit" }))
      .mockResolvedValueOnce(finish());
    expect((await sendTurn({ message: "Fifth question" })).status).toBe(200);
    const unavailable = lastToolOutcome() as {
      semanticStatus: string;
      matches: { entryId: string }[];
    };
    expect(unavailable.semanticStatus).toBe("unavailable");
    expect(unavailable.matches).toEqual([
      {
        entryId: eLiteral.id,
        title: "Ferryman contract",
        excerpt: "The ferryman takes ten zenit at the dawn crossing.",
        source: "literal",
      },
    ]);

    // get_notes returns full plain text in request order; missing and foreign
    // entry IDs are indistinguishable and produce no entry data.
    const foreign = await createNote(
      "Other game entry",
      documentOf("A different game keeps its secrets."),
      foreignNotesPath(),
      "outsider",
    );
    const missing = randomUUID();
    complete.mockResolvedValueOnce(
      tool("get_notes", { entryIds: [eAligned.id, missing, foreign.id] }),
    );
    const readTurn = await sendTurn({ message: "Sixth question" });
    expect(readTurn.status).toBe(200);
    const readOutcome = lastToolOutcome() as {
      entries: { entryId: string; title: string; text: string; updatedAt: string }[];
      missingEntryIds: string[];
    };
    expect(readOutcome.entries).toEqual([
      {
        entryId: eAligned.id,
        title: "Lighthouse ledger",
        text: "The keeper counts candles.",
        updatedAt: expect.any(String),
      },
    ]);
    expect(readOutcome.missingEntryIds).toEqual([missing, foreign.id]);
    const toolSummaries = (await readTurn.json()).tools as { tool: string; label: string }[];
    expect(toolSummaries).toEqual([{ tool: "get_notes", label: "Read saved note entries" }]);
  });

  it("API-07 keeps note reads guarded, label-clean, and strictly read-only", async () => {
    complete.mockReset().mockResolvedValue(finish());
    const turnGame = randomUUID();
    await fixture.pool.query(
      "INSERT INTO games(id,name,system_id,gm_account_id) VALUES($1,'Guarded turn game','fabula-ultima',$2)",
      [turnGame, fixture.ids.gm],
    );
    await fixture.pool.query(
      "INSERT INTO players(id,game_id,account_id,name) VALUES($1,$2,$3,'Player')",
      [randomUUID(), turnGame, fixture.ids.player],
    );
    const notesPath = `/games/${turnGame}/notes`;
    const entry = await createNote(
      "Toll ledger",
      documentOf("The ledger hides the candle inventory."),
      notesPath,
    );
    const resetAgentWindow = () =>
      fixture.pool.query(
        "UPDATE sign_in_attempts SET window_started_at=now()-interval '2 minutes'",
      );
    const sendTurn = async (message: string, actor = "gm") => {
      await resetAgentWindow();
      return fixture.request(`/games/${turnGame}/agent/turns`, actor, "POST", { message });
    };
    const rowsSnapshot = () =>
      fixture.pool.query(
        "SELECT game_id, entry_id, ordinal, text_fingerprint, passage_text FROM game_note_passages ORDER BY game_id, entry_id, ordinal",
      );

    // Out-of-bounds and forged tool arguments fail the turn, never return empty data.
    const before = await noteRows(turnGame);
    const passagesBefore = await rowsSnapshot();
    const invalidSearches = [
      tool("search_notes", { query: "    " }),
      tool("search_notes", { query: "x".repeat(513) }),
      tool("search_notes", { query: "ledger", limit: 0 }),
      tool("search_notes", { query: "ledger", limit: 11 }),
      tool("search_notes", { query: "ledger", sort: "title" }),
      tool("search_notes", { query: 42 }),
      tool("get_notes", { entryIds: [] }),
      tool("get_notes", { entryIds: [entry.id, entry.id] }),
      tool("get_notes", { entryIds: [entry.id, "not-a-uuid"] }),
      tool("get_notes", { entryIds: [entry.id, entry.id, entry.id, entry.id] }),
      tool("get_notes", { entryIds: entry.id }),
    ];
    for (const invalid of invalidSearches) {
      complete.mockReset().mockResolvedValueOnce(invalid).mockResolvedValue(finish());
      const response = await sendTurn("Read the ledger");
      expect(response.status, JSON.stringify(invalid.calls[0])).toBe(502);
      expect(await response.json()).toMatchObject({ error: { code: "ERR05" } });
      expect(
        (await fixture.pool.query("SELECT count(*) FROM agent_turns WHERE game_id=$1", [turnGame]))
          .rows[0].count,
      ).toBe("0");
    }
    expect(await noteRows(turnGame)).toEqual(before);
    expect((await rowsSnapshot()).rows).toEqual(passagesBefore.rows);

    // Players never reach the tools, and rejected turns persist nothing.
    complete.mockReset().mockResolvedValue(tool("search_notes", { query: "ledger" }));
    const refused = await sendTurn("Read the ledger", "player");
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ error: { code: "ERR82" } });
    expect(
      (await fixture.pool.query("SELECT count(*) FROM agent_turns WHERE game_id=$1", [turnGame]))
        .rows[0].count,
    ).toBe("0");

    // A successful multi-tool turn stores only fixed labels with the reply.
    complete
      .mockReset()
      .mockResolvedValueOnce(tool("search_notes", { query: "  ledger  " }))
      .mockResolvedValueOnce(tool("get_notes", { entryIds: [entry.id] }))
      .mockResolvedValueOnce(finish("Done with notes."));
    const cited = await sendTurn("Seventh question");
    expect(cited.status).toBe(200);
    expect((await cited.json()).tools).toEqual([
      { tool: "search_notes", label: "Searched the GM’s notes" },
      { tool: "get_notes", label: "Read saved note entries" },
    ]);
    const storedTurns = await fixture.pool.query(
      "SELECT message, reply, tools FROM agent_turns WHERE game_id=$1",
      [turnGame],
    );
    expect(storedTurns.rows).toEqual([
      {
        message: "Seventh question",
        reply: "Done with notes.",
        tools: [
          { tool: "search_notes", label: "Searched the GM’s notes" },
          { tool: "get_notes", label: "Read saved note entries" },
        ],
      },
    ]);
    expect(JSON.stringify(storedTurns.rows)).not.toContain("candle");
    expect(JSON.stringify(storedTurns.rows)).not.toContain("ledger");

    // Successful note turns change no notebook rows either.
    expect(await noteRows(turnGame)).toEqual(before);
    expect((await rowsSnapshot()).rows).toEqual(passagesBefore.rows);
  });
});
