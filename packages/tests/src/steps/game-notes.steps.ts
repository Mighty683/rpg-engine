import { randomUUID } from "node:crypto";
import { After, Given, Then, When } from "@cucumber/cucumber";
import { expect, inject } from "vite-plus/test";
import {
  createActorGame,
  createGameAccessService,
} from "../../../backend/src/modules/games/service.ts";
import { createGameNotesService } from "../../../backend/src/modules/game-notes/service.ts";
import { databaseFromPool } from "../../../backend/src/database/client.ts";
import type {
  GameNoteEntryRecord,
  NoteDocument,
} from "../../../backend/src/modules/game-notes/types.ts";
import { seedGame, seedPool, type SeededGame } from "../support/seed.ts";
import type { BrowserWorld } from "../support/world.ts";
import { GameTablePage } from "../pages/game-table-page.ts";
import { GameNotesPage } from "../pages/game-notes-page.ts";
import { AgentPage } from "../pages/agent-page.ts";
import { startAgentServer } from "../support/agent-server.ts";
import { deterministicNoteEmbeddings, notesReaderProvider } from "../support/agent-provider.ts";

/**
 * Game notes steps: scenarios drive the real frontend against the real
 * backend. Entries are seeded through the notes service, persisted effects
 * are verified in the scenario schema, and every step takes its game and
 * entries from the explicit scenario state kept on the World.
 */
const frontendUrl = () => inject("frontendUrl") as string;

type FreshGame = { gameId: string; name: string };

type ScenarioState = {
  seed?: SeededGame;
  fresh?: FreshGame;
  notes: GameNotesPage;
  seededEntryIds: string[];
  savedEntryIds: string[];
  openedEntryId: string;
  notesRequests: string[];
  prompted?: boolean;
  agent?: AgentPage;
  agentServer?: Awaited<ReturnType<typeof startAgentServer>>;
};

function world(this: BrowserWorld): ScenarioState {
  const self = this as BrowserWorld & { notesState?: ScenarioState };
  self.notesState ??= {
    notes: new GameNotesPage(this.page),
    seededEntryIds: [],
    savedEntryIds: [],
    openedEntryId: "",
    notesRequests: [],
  };
  return self.notesState;
}

After(async function (this: BrowserWorld) {
  const state = (this as BrowserWorld & { notesState?: ScenarioState }).notesState;
  if (!state) return;
  await state.agentServer?.close();
  state.agentServer = undefined;
});

const gmActor = (game: SeededGame) => ({ accountId: game.gm.accountId, sessionId: randomUUID() });

const plainBody = (text: string): NoteDocument => ({ ops: [{ insert: `${text}\n` }] });

const formattedBody = (heading: string, bold: string, rest: string): NoteDocument => ({
  ops: [
    { insert: `${heading}\n`, attributes: { header: 1 } },
    { insert: bold, attributes: { bold: true } },
    { insert: `${rest}\n` },
  ],
});

const marshTitle = (index: number) => `Marsh entry ${String(index).padStart(2, "0")}`;

async function withPool<T>(run: (pool: Awaited<ReturnType<typeof seedPool>>) => Promise<T>) {
  const pool = await seedPool();
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

const notesService = (pool: Awaited<ReturnType<typeof seedPool>>) =>
  createGameNotesService({
    database: databaseFromPool(pool),
    gameAccessFor: createGameAccessService,
  });

async function createNote(game: SeededGame, title: string, content: NoteDocument) {
  return withPool(async (pool) =>
    notesService(pool).create(gmActor(game), game.gameId, {
      id: randomUUID(),
      title,
      content,
    }),
  );
}

async function updateNote(
  game: SeededGame,
  entryId: string,
  expectedRevision: number,
  changes: { title?: string; content?: NoteDocument },
) {
  return withPool(async (pool) =>
    notesService(pool).update(gmActor(game), game.gameId, entryId, { expectedRevision, changes }),
  );
}

type StoredNote = { record: GameNoteEntryRecord; text: string };

async function readNote(gameId: string, entryId: string): Promise<StoredNote> {
  return withPool(async (pool) => {
    const result = await pool.query(
      "SELECT id, title, revision, created_at, updated_at, content FROM game_note_entries WHERE game_id=$1 AND id=$2",
      [gameId, entryId],
    );
    const row = result.rows[0];
    if (!row) throw new Error(`Note ${entryId} is missing`);
    const text = await pool.query(
      "SELECT string_agg(op->>'insert','') AS text FROM jsonb_array_elements($1::jsonb->'ops') AS o(op)",
      [JSON.stringify(row.content)],
    );
    const record = {
      id: row.id,
      title: row.title,
      content: row.content,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      revision: Number(row.revision),
    } as GameNoteEntryRecord;
    return { record, text: String(text.rows[0].text) };
  });
}

async function entryIdWithTitle(gameId: string, title: string) {
  return withPool(async (pool) => {
    const result = await pool.query(
      "SELECT id FROM game_note_entries WHERE game_id=$1 AND title=$2",
      [gameId, title],
    );
    return (result.rows[0]?.id as string) ?? "";
  });
}

/** The create request is still in flight right after clicking; wait for the persisted row. */
async function waitForEntryWithTitle(gameId: string, title: string) {
  for (let tries = 0; tries < 50; tries += 1) {
    const id = await entryIdWithTitle(gameId, title);
    if (id) return id;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Note titled "${title}" was never created`);
}

async function renameGame(game: SeededGame, name: string) {
  await withPool(async (pool) => {
    await pool.query("UPDATE games SET name=$1 WHERE id=$2", [name, game.gameId]);
  });
}

/** Seeds the notebook; entry 1 is the newest and carries the formatted body. */
async function seedNotebook(this: BrowserWorld, game: SeededGame, count: number) {
  const state = world.call(this as unknown as BrowserWorld);
  state.seededEntryIds = [];
  state.savedEntryIds = [];
  for (let index = 1; index <= count; index++) {
    const content =
      index === 1
        ? formattedBody(
            "Ferryman contract",
            "Mara will take the party across at dawn",
            "The routine fare is ten zenit and one Compass reading.",
          )
        : [5, 12].includes(index)
          ? plainBody(`Routine compass observations at the pier ${index}`)
          : plainBody(`Routine note ${index} of the marsh patrol`);
    const entry = await createNote(game, marshTitle(index), content);
    const stamp = new Date(Date.now() - (index - 1) * 60_000);
    await withPool(async (pool) => {
      await pool.query(
        "UPDATE game_note_entries SET created_at=$1, updated_at=$1 WHERE game_id=$2 AND id=$3",
        [stamp, game.gameId, entry.id],
      );
    });
    state.seededEntryIds.push(entry.id);
  }
}

async function signInAndOpenNotes(game: SeededGame, page: BrowserWorld["page"]) {
  const table = new GameTablePage(page);
  await table.signIn(frontendUrl(), game.gm.username, game.gm.password);
  await new GameNotesPage(page).openNotes(frontendUrl(), game.gameId);
}

async function signInAndOpenTable(game: SeededGame, page: BrowserWorld["page"]) {
  const table = new GameTablePage(page);
  await table.signIn(frontendUrl(), game.gm.username, game.gm.password);
  await table.openGame(frontendUrl(), game.gameId);
}

async function openSeededEntry(state: ScenarioState, title: string, body: string) {
  const entry = await createNote(state.seed!, title, plainBody(body));
  state.openedEntryId = entry.id;
  await state.notes.openNotes(frontendUrl(), state.seed!.gameId);
  await state.notes.resultCard(entry.id).click();
  await expect.poll(() => state.notes.noteTitle.inputValue()).toBe(title);
}

Given(
  "a GM has a game with saved note entries at the table at {int} by {int}",
  async function (this: BrowserWorld, width: number, height: number) {
    const state = world.call(this);
    await this.page.setViewportSize({ width, height });
    state.seed = await seedGame({ gmWeapon: "none" });
    await seedNotebook.call(this, state.seed, 25);
    await signInAndOpenTable(state.seed, this.page);
  },
);

Given(
  'a GM is on the notes screen of "The Lantern Road" at {int} by {int}',
  async function (this: BrowserWorld, width: number, height: number) {
    const state = world.call(this);
    await this.page.setViewportSize({ width, height });
    state.seed = await seedGame({ gmWeapon: "none" });
    await renameGame(state.seed, "The Lantern Road");
    await signInAndOpenNotes(state.seed, this.page);
  },
);

Given(
  'a GM has 25 saved entries in "The Lantern Road" and a fresh game with an empty notebook at {int} by {int}',
  async function (this: BrowserWorld, width: number, height: number) {
    const state = world.call(this);
    await this.page.setViewportSize({ width, height });
    state.seed = await seedGame({ gmWeapon: "none" });
    await renameGame(state.seed, "The Lantern Road");
    state.fresh = await withPool(async (pool) => {
      const game = await createActorGame(
        databaseFromPool(pool),
        gmActor(state.seed!),
        "Fresh fields",
        "fabula-ultima",
      );
      return { gameId: game.id, name: "Fresh fields" };
    });
    await seedNotebook.call(this, state.seed, 25);
    await signInAndOpenTable(state.seed, this.page);
  },
);

Given(
  "a GM has an entry detail open at {int} by {int}",
  async function (this: BrowserWorld, width: number, height: number) {
    const state = world.call(this);
    await this.page.setViewportSize({ width, height });
    state.seed = await seedGame({ gmWeapon: "none" });
    await signInAndOpenNotes(state.seed, this.page);
    await openSeededEntry(state, "Ferryman contract", "The ferryman takes ten zenit at dawn.");
  },
);

Given(
  "a GM opens a new entry at {int} by {int}",
  async function (this: BrowserWorld, width: number, height: number) {
    const state = world.call(this);
    await this.page.setViewportSize({ width, height });
    state.seed = await seedGame({ gmWeapon: "none" });
    const table = new GameTablePage(this.page);
    await table.signIn(frontendUrl(), state.seed.gm.username, state.seed.gm.password);
    await state.notes.openNewEntry(frontendUrl(), state.seed.gameId);
  },
);

Given(
  "a GM has saved notes and a player has the same game open at {int} by {int}",
  async function (this: BrowserWorld, width: number, height: number) {
    const state = world.call(this);
    await this.page.setViewportSize({ width, height });
    state.seed = await seedGame({ gmWeapon: "none" });
    await renameGame(state.seed, "The Lantern Road");
    await createNote(state.seed, "Ferryman contract", plainBody("kept secret from players"));
    await createNote(state.seed, "Second note", plainBody("extra secret detail"));
    const table = new GameTablePage(this.page);
    await table.signIn(frontendUrl(), state.seed.player.username, state.seed.player.password);
    await table.openGame(frontendUrl(), state.seed.gameId);
  },
);

When("the GM opens the Game notes EdgeTab", async function (this: BrowserWorld) {
  await world.call(this).notes.openTableDrawer();
});

Then(
  "the drawer shows the newest entries first with title, content and both dates",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    const cards = state.notes.cards("drawer");
    await expect.poll(() => cards.count()).toBe(20);
    const titles = await cards.locator(".note-open").allTextContents();
    expect(titles).toEqual(
      state.seededEntryIds.slice(0, 20).map((_, index) => marshTitle(index + 1)),
    );
    const newest = state.notes.drawerCard(state.seededEntryIds[0]!);
    await expect
      .poll(() => newest.getByTestId("note-metadata").textContent())
      .toMatch(/Created .+ · Updated .+/);
    await expect
      .poll(() => newest.locator("strong").textContent())
      .toBe("Mara will take the party across at dawn");
  },
);

When("the GM scrolls the drawer to the bottom", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.drawerList.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
});

Then(
  "older entries load in order without losing the loaded cards",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    const cards = state.notes.cards("drawer");
    await expect.poll(() => cards.count()).toBe(25);
    const titles = await cards.locator(".note-open").allTextContents();
    expect(titles).toEqual(state.seededEntryIds.map((_, index) => marshTitle(index + 1)));
  },
);

When("the GM selects an entry card", async function (this: BrowserWorld) {
  const state = world.call(this);
  state.openedEntryId = state.seededEntryIds[0]!;
  await state.notes.drawerCard(state.openedEntryId).click();
});

Then("the entry detail opens on the notes screen", async function (this: BrowserWorld) {
  const state = world.call(this);
  await expect
    .poll(() => this.page.url())
    .toBe(`${frontendUrl()}/games/${state.seed!.gameId}/notes`);
  await expect.poll(() => state.notes.noteTitle.inputValue()).toBe(marshTitle(1));
  await expect.poll(() => state.notes.backToResults.isVisible()).toBe(true);
});

When("the GM returns to the table and dismisses the drawer", async function (this: BrowserWorld) {
  const state = world.call(this);
  this.page.removeAllListeners("dialog");
  this.page.on("dialog", async (dialog) => {
    world.call(this).prompted = true;
    await dialog.dismiss();
  });
  world.call(this).prompted = false;
  await state.notes.backToGame.click();
  await this.page.getByTestId("game-table").waitFor({ state: "visible" });
  await state.notes.openTableDrawer();
  await state.notes.dismissTableDrawer();
});

Then(
  "the table is restored at the same position with no unsaved-changes prompt",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await this.page.getByTestId("game-table").waitFor({ state: "visible" });
    expect(this.page.url()).toBe(`${frontendUrl()}/games/${state.seed!.gameId}`);
    expect(world.call(this).prompted).toBe(false);
    await expect.poll(() => state.notes.drawerPanel.isHidden()).toBe(true);
    await expect.poll(() => state.notes.drawerTab.isVisible()).toBe(true);
    await expect.poll(() => this.page.getByTestId("edge-tab-history").isVisible()).toBe(true);
  },
);

When(
  "the GM opens New entry, enters a title and formatted body, and creates the entry",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await this.page.getByTestId("note-new").click();
    await state.notes.createEntry.waitFor({ state: "visible" });
    await state.notes.fillTitle("Mirror lake");
    await state.notes.typeBody("Meet the diver at ");
    await state.notes.typeFormattedLine("bold", "salt tower");
    await this.page.keyboard.press("Enter");
    await state.notes.createEntry.click();
    state.savedEntryIds.push(await waitForEntryWithTitle(state.seed!.gameId, "Mirror lake"));
  },
);

Then(
  "a toast confirms and the saved entry detail opens with both timestamps",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect.poll(() => state.notes.createdToast.textContent()).toBe("Entry created.");
    await expect
      .poll(() => this.page.url())
      .toBe(`${frontendUrl()}/games/${state.seed!.gameId}/notes`);
    await expect.poll(() => state.notes.noteTitle.inputValue()).toBe("Mirror lake");
    await expect
      .poll(() => state.notes.content.textContent())
      .toContain("Meet the diver at salt tower");
    await expect
      .poll(() => this.page.getByTestId("note-detail-metadata").textContent())
      .toMatch(/Created .+ · Updated .+/);
  },
);

When("the GM reloads the page", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.openNotes(frontendUrl(), state.seed!.gameId);
});

Then("the entry is still there with the same saved content", async function (this: BrowserWorld) {
  const state = world.call(this);
  const card = state.notes.resultCard(state.savedEntryIds[0]!);
  await card.waitFor({ state: "visible" });
  await expect.poll(() => state.notes.cardTitle(card).textContent()).toBe("Mirror lake");
  await expect
    .poll(() => state.notes.cardBody(card).locator("strong").textContent())
    .toBe("salt tower");
});

When("the GM cancels a new entry", async function (this: BrowserWorld) {
  const state = world.call(this);
  await this.page.getByTestId("note-new").click();
  await state.notes.createEntry.waitFor({ state: "visible" });
  await state.notes.fillTitle("Cannery run");
  await state.notes.typeBody("Bring the crates to the pier");
  await state.notes.cancelEntry.click();
});

Then(
  "the notes list shows again and the draft is preserved for the same game",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await state.notes.searchInput.waitFor({ state: "visible" });
    await expect.poll(() => state.notes.createEntry.isHidden()).toBe(true);
    await this.page.getByTestId("note-new").click();
    await state.notes.createEntry.waitFor({ state: "visible" });
    await expect.poll(() => state.notes.noteTitle.inputValue()).toBe("Cannery run");
    await expect
      .poll(() => state.notes.content.textContent())
      .toContain("Bring the crates to the pier");
  },
);

When("the GM creates the preserved draft", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.createEntry.click();
  state.savedEntryIds.push(await waitForEntryWithTitle(state.seed!.gameId, "Cannery run"));
});

Then(
  "the second entry detail opens with the preserved title and body",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect.poll(() => state.notes.noteTitle.inputValue()).toBe("Cannery run");
    await expect
      .poll(() => state.notes.content.textContent())
      .toContain("Bring the crates to the pier");
    await expect
      .poll(() => this.page.url())
      .toBe(`${frontendUrl()}/games/${state.seed!.gameId}/notes`);
  },
);

When("the GM opens Search all entries with a blank query", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.openTableDrawer();
  await state.notes.searchAllEntries.click();
  await state.notes.searchInput.waitFor({ state: "visible" });
});

Then("the first 20 entries are listed newest first", async function (this: BrowserWorld) {
  const state = world.call(this);
  const cards = state.notes.cards("list");
  await expect.poll(() => cards.count()).toBe(20);
  const titles = await cards.locator(".note-open").allTextContents();
  expect(titles).toEqual(
    state.seededEntryIds.slice(0, 20).map((_, index) => marshTitle(index + 1)),
  );
  expect(new Set(titles).size).toBe(20);
});

Then("the drawer of the fresh game shows no entries yet", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.openTable(frontendUrl(), state.fresh!.gameId);
  await state.notes.openTableDrawer();
  await expect.poll(() => state.notes.emptyNotebook.isVisible()).toBe(true);
  await expect.poll(() => state.notes.noMatch.isHidden()).toBe(true);
  await state.notes.dismissTableDrawer();
});

When(
  'the GM searches "compass" inside an entry body, ignoring case',
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await state.notes.openNotes(frontendUrl(), state.seed!.gameId);
    await state.notes.searchInput.fill("compass");
  },
);

Then(
  "the matching entries are listed and a non-matching query shows the no-match state",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    const matching = state.notes.cards("list");
    await expect.poll(() => matching.count()).toBe(3);
    const titles = await matching.locator(".note-open").allTextContents();
    expect(titles).toEqual([marshTitle(1), marshTitle(5), marshTitle(12)]);
    await state.notes.searchInput.fill("observatory");
    await expect.poll(() => state.notes.noMatch.textContent()).toBe("No matching entries.");
    await expect.poll(() => state.notes.emptyNotebook.isHidden()).toBe(true);
  },
);

When('the GM searches "Routine" again', async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.searchInput.fill("Routine");
});

Then("the result list resets to the first page", async function (this: BrowserWorld) {
  const state = world.call(this);
  await expect.poll(() => state.notes.cards("list").count()).toBe(20);
});

When("the GM scrolls the results to the bottom", async function (this: BrowserWorld) {
  await this.page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
});

Then(
  "the next page appends below the loaded cards and stops at the end",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    const cards = state.notes.cards("list");
    await expect.poll(() => cards.count()).toBe(25);
    const titles = await cards.locator(".note-open").allTextContents();
    expect(titles).toEqual(state.seededEntryIds.map((_, index) => marshTitle(index + 1)));
    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await this.page.waitForTimeout(500);
    expect(await cards.count()).toBe(25);
  },
);

When(
  "the GM selects a result by click or Enter on the focused title",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await state.notes.resultCard(state.seededEntryIds[0]!).click();
    await expect.poll(() => state.notes.noteTitle.inputValue()).toBe(marshTitle(1));
    await state.notes.backToResults.click();
    await state.notes.cardTitle(state.notes.resultCard(state.seededEntryIds[1]!)).focus();
    await this.page.keyboard.press("Enter");
    await expect.poll(() => state.notes.noteTitle.inputValue()).toBe(marshTitle(2));
  },
);

Then(
  "the entry detail opens, and Back to results keeps the search term",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect.poll(() => state.notes.backToResults.isVisible()).toBe(true);
    await state.notes.backToResults.click();
    await state.notes.searchInput.waitFor({ state: "visible" });
    await expect.poll(() => state.notes.searchInput.inputValue()).toBe("Routine");
  },
);

When("the GM edits the body without leaving the field", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.focusBody();
  await this.page.keyboard.press("Control+End");
  await this.page.keyboard.type(" Bring rope.");
});

Then(
  "the change shows immediately and saves after 2 seconds idle, even while focused",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect.poll(() => state.notes.content.textContent()).toContain(" Bring rope.");
    const focused = await state.notes.content.evaluate(
      (element) => document.activeElement === element || element.contains(document.activeElement),
    );
    expect(focused).toBe(true);
    await this.page.waitForTimeout(1_200);
    const early = await readNote(state.seed!.gameId, state.openedEntryId);
    expect(early.text).not.toContain("Bring rope");
    await expect
      .poll(
        async () =>
          (await readNote(state.seed!.gameId, state.openedEntryId)).text.includes(" Bring rope."),
        { timeout: 4_000 },
      )
      .toBe(true);
  },
);

When("the GM edits the title and leaves the field", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.fillTitle("Ferryman contract revised");
  await this.page.getByTestId("notes-heading").click();
});

Then("the pending change flushes immediately", async function (this: BrowserWorld) {
  const state = world.call(this);
  await expect
    .poll(async () => (await readNote(state.seed!.gameId, state.openedEntryId)).record.title, {
      timeout: 1_500,
    })
    .toBe("Ferryman contract revised");
});

Then(
  "the list and metadata refresh from the server acknowledgement with local-time dates",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    const stored = await readNote(state.seed!.gameId, state.openedEntryId);
    expect(stored.record.revision).toBe(3);
    await state.notes.backToResults.click();
    const card = state.notes.resultCard(state.openedEntryId);
    await card.waitFor({ state: "visible" });
    await expect
      .poll(() => state.notes.cardTitle(card).textContent())
      .toBe("Ferryman contract revised");
    await expect.poll(() => state.notes.cardBody(card).textContent()).toContain(" Bring rope.");
    const metadata = await state.notes.cardMetadata(card).textContent();
    expect(metadata?.includes("Created")).toBe(true);
    expect(metadata).toContain("Updated");
  },
);

When("the network fails while the body edit is saved", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.blockNoteSaves();
  await state.notes.focusBody();
  await this.page.keyboard.press("Control+End");
  await this.page.keyboard.type(" Dart the rope.");
  await this.page.getByTestId("notes-heading").click();
});

Then(
  "the GM gets a recovery toast and the typed draft stays editable",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect
      .poll(() => state.notes.errorToast.textContent())
      .toBe("Could not save this entry. Your text is available in the editor.");
    await expect.poll(() => state.notes.content.textContent()).toContain(" Dart the rope.");
    await state.notes.focusBody();
    await this.page.keyboard.press("Control+End");
    await this.page.keyboard.type("x");
    await expect.poll(() => state.notes.content.textContent()).toContain(" Dart the rope.x");
  },
);

When("the GM explicitly retries", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.unblockNoteSaves();
  await state.notes.retryToastAction();
});

Then(
  "the retained text is saved onto the refreshed server version",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect
      .poll(async () =>
        (await readNote(state.seed!.gameId, state.openedEntryId)).text.includes(" Dart the rope.x"),
      )
      .toBe(true);
    const stored = await readNote(state.seed!.gameId, state.openedEntryId);
    expect(stored.record.revision).toBe(2);
  },
);

When(
  "another session saves the same entry and the GM edits it again",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    const current = await readNote(state.seed!.gameId, state.openedEntryId);
    await updateNote(state.seed!, state.openedEntryId, current.record.revision, {
      title: "Claimed by the ferry",
      content: plainBody("The server keeps the toll ledger."),
    });
    await state.notes.focusBody();
    await this.page.keyboard.press("Control+End");
    await this.page.keyboard.type(" Diver waits.");
  },
);

When("the GM flushes their edit", async function (this: BrowserWorld) {
  await this.page.getByTestId("notes-heading").click();
});

Then(
  "the conflict save is rejected with a recovery toast and the typed draft stays editable",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect
      .poll(() => state.notes.errorToast.textContent())
      .toBe("Could not save this entry. Your text is available in the editor.");
    await expect.poll(() => state.notes.content.textContent()).toContain(" Diver waits.");
    await expect.poll(() => state.notes.noteTitle.inputValue()).toBe("Ferryman contract");
  },
);

When("the GM retries the conflict explicitly", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.retryToastAction();
});

Then(
  "the retained text is reapplied only onto the refreshed server version",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect
      .poll(async () =>
        (await readNote(state.seed!.gameId, state.openedEntryId)).text.includes(" Diver waits."),
      )
      .toBe(true);
    const stored = await readNote(state.seed!.gameId, state.openedEntryId);
    expect(stored.record.title).toBe("Claimed by the ferry");
    expect(stored.record.revision).toBe(4);
    await expect.poll(() => state.notes.noteTitle.inputValue()).toBe("Ferryman contract");
  },
);

When("the next body save returns a confirmed rejection", async function (this: BrowserWorld) {
  const state = world.call(this);
  await this.page.route(/\/api\/games\/[^/]+\/notes\/[^/]+$/, (route) => {
    const request = route.request();
    if (request.method() !== "PATCH") {
      void route.continue();
      return;
    }
    const body = JSON.parse(request.postData() ?? "{}") as {
      expectedRevision: number;
      changes: { title?: string; content?: NoteDocument };
    };
    const broken = {
      expectedRevision: body.expectedRevision,
      changes: { ...body.changes, content: { ops: [{ insert: "missing terminal newline" }] } },
    };
    void route.continue({ postData: JSON.stringify(broken) });
  });
  await state.notes.focusBody();
  await this.page.keyboard.press("Control+End");
  await this.page.keyboard.type(" Refusal.");
  await this.page.getByTestId("notes-heading").click();
});

Then(
  "the view restores the acknowledged result while the draft stays editable",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect
      .poll(() => state.notes.errorToast.textContent())
      .toBe("Could not save this entry. Your text is available in the editor.");
    const stored = await readNote(state.seed!.gameId, state.openedEntryId);
    expect(stored.text).not.toContain("Refusal");
    expect(stored.record.revision).toBe(4);
    await state.notes.backToResults.click();
    await expect
      .poll(() => state.notes.cardBody(state.notes.resultCard(state.openedEntryId)).textContent())
      .not.toContain("Refusal");
    await state.notes.resultCard(state.openedEntryId).click();
    await expect.poll(() => state.notes.content.textContent()).toContain(" Refusal.");
  },
);

Then("the player's table has no Game notes tab or drawer", async function (this: BrowserWorld) {
  expect(await this.page.getByTestId("edge-tab-notes").count()).toBe(0);
  expect(await this.page.getByTestId("notes-panel").count()).toBe(0);
});

When("the player visits the notes routes directly", async function (this: BrowserWorld) {
  const state = world.call(this);
  state.notesRequests = [];
  this.page.on("request", (request) => {
    if (request.resourceType() === "document") return;
    const url = request.url();
    if (url.includes("/api/") && url.includes("/notes")) state.notesRequests.push(url);
  });
  await state.notes.openNotes(frontendUrl(), state.seed!.gameId);
  await expect.poll(() => state.notes.unavailable.isVisible()).toBe(true);
  await state.notes.page.goto(`${frontendUrl()}/games/${state.seed!.gameId}/notes/new`);
  await expect.poll(() => state.notes.unavailable.isVisible()).toBe(true);
});

Then(
  "an unavailable screen appears with a route back and no notes request is made",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    const back = state.notes.unavailableBack;
    await expect.poll(() => back.getAttribute("href")).toBe(`/games/${state.seed!.gameId}`);
    await expect.poll(() => back.textContent()).toBe("The Lantern Road");
    await this.page.waitForTimeout(400);
    expect(state.notesRequests).toEqual([]);
  },
);

Then(
  "the toolbar offers only headings, lists, bold, italic, underline, strikethrough and clear formatting",
  async function (this: BrowserWorld) {
    const toolbar = this.page.getByTestId("note-toolbar");
    const controls = toolbar.locator(":scope > *");
    const testIds = await controls.evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const id = node instanceof HTMLElement && node.dataset.testid;
        return id ? [id] : [];
      }),
    );
    expect(testIds.slice().sort()).toEqual(
      [
        "note-format-header",
        "note-format-bullet",
        "note-format-clean",
        "note-format-bold",
        "note-format-italic",
        "note-format-ordered",
        "note-format-strike",
        "note-format-underline",
      ].sort(),
    );
    const options = await this.page
      .getByTestId("note-format-header")
      .locator("option")
      .allTextContents();
    expect(options).toEqual(["Normal text", "Heading 1", "Heading 2", "Heading 3"]);
    expect(await controls.count()).toBe(8);
  },
);

When("the GM pastes rich text into the body", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.focusBody();
  await state.notes.pasteHtml(
    '<p><b>bold</b> <i>italic</i> <u>underline</u> <s>struck</s> <span style="color:red">colored</span> <a href="https://example.com">linked </a></p><h4>minor heading</h4>',
    "bold italic underline struck colored linked minor heading",
  );
});

Then("paste keeps only supported text and formatting", async function (this: BrowserWorld) {
  const state = world.call(this);
  await expect
    .poll(() => state.notes.content.textContent())
    .toContain("bold italic underline struck colored linked minor heading");
  await expect.poll(() => state.notes.content.locator("strong").count()).toBe(1);
  await expect.poll(() => state.notes.content.locator("em").count()).toBe(1);
  await expect.poll(() => state.notes.content.locator("u").count()).toBe(1);
  await expect.poll(() => state.notes.content.locator("s").count()).toBe(1);
  await expect.poll(() => state.notes.content.locator("a").count()).toBe(0);
  await expect.poll(() => state.notes.content.locator("h4, h5, h6").count()).toBe(0);
  const colors = await state.notes.content.locator("[style]").count();
  expect(colors).toBe(0);
});

When(
  "the GM applies a heading, a bulleted list, bold text and clears formatting on a line",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await state.notes.gotoBodyStart();
    await state.notes.applyHeading("1");
    await state.notes.gotoBodyEnd();
    await this.page.keyboard.press("Enter");
    await state.notes.formatButton("bullet").click();
    await this.page.keyboard.type("Scout the ruin");
    await this.page.keyboard.press("Enter");
    await this.page.keyboard.type("Ask the ferryman");
    // Exit the list on the empty continuation line, not on a typed item.
    await this.page.keyboard.press("Enter");
    await state.notes.formatButton("bullet").click();
    await state.notes.typeFormattedLine("bold", "kept bold text");
    await state.notes.gotoBodyEnd();
    await state.notes.selectCurrentLine();
    await state.notes.clearSelectionFormatting();
  },
);
When("the GM creates the entry", async function (this: BrowserWorld) {
  const state = world.call(this);
  await state.notes.fillTitle("Formatting notes");
  await state.notes.createEntry.click();
  state.savedEntryIds.push(await waitForEntryWithTitle(state.seed!.gameId, "Formatting notes"));
  await expect.poll(() => state.notes.createdToast.textContent()).toBe("Entry created.");
});

Then(
  "the drawer and results cards render the supported formatting without an editor toolbar",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    const entryId = state.savedEntryIds.at(-1)!;
    await state.notes.backToResults.click();
    const card = state.notes.resultCard(entryId);
    await card.waitFor({ state: "visible" });
    await expect
      .poll(async () => (await state.notes.cardBody(card).locator("h1").textContent())?.trim())
      .toBe("bold italic underline struck colored linked");
    await expect.poll(() => state.notes.cardBody(card).locator("ul li").count()).toBe(2);
    await expect.poll(() => state.notes.cardBody(card).locator("strong").count()).toBe(1);
    await expect.poll(() => state.notes.cardBody(card).locator("em").count()).toBe(1);
    await expect.poll(() => state.notes.cardBody(card).locator("u").count()).toBe(1);
    await expect.poll(() => state.notes.cardBody(card).locator("s").count()).toBe(1);
    expect(await card.getByTestId("note-toolbar").count()).toBe(0);
    await state.notes.backToGame.click();
    await this.page.getByTestId("game-table").waitFor({ state: "visible" });
    await state.notes.openTableDrawer();
    const drawerCard = state.notes.drawerCard(entryId);
    await state.notes.drawerCard(entryId).waitFor({ state: "visible" });
    await expect.poll(() => state.notes.cardBody(drawerCard).locator("ul li").count()).toBe(2);
    await expect.poll(() => state.notes.cardBody(drawerCard).locator("h1").count()).toBe(1);
    expect(await drawerCard.getByTestId("note-toolbar").count()).toBe(0);
  },
);

Given(
  "a GM has a saved entry about the marsh crossing at {int} by {int}",
  async function (this: BrowserWorld, width: number, height: number) {
    const state = world.call(this);
    await this.page.setViewportSize({ width, height });
    state.seed = await seedGame({ gmWeapon: "none" });
    await renameGame(state.seed, "The Lantern Road");
    // The Agent backend starts before the notes exist, so the startup sweep
    // finds nothing and literal retrieval drives the scenario deterministically.
    state.agentServer = await startAgentServer(notesReaderProvider, deterministicNoteEmbeddings);
    state.agent = new AgentPage(this.page);
    await createNote(
      state.seed,
      "Ferryman contract",
      plainBody("Mara takes the party across the marsh at dawn for ten zenit."),
    );
    await createNote(
      state.seed,
      "Lighthouse ledger",
      plainBody("The keeper counts candles and oil every evening."),
    );
  },
);

When(
  "the GM asks the Agent about the crossing in the private chat",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    const table = new GameTablePage(this.page);
    await table.signIn(state.agentServer!.url, state.seed!.gm.username, state.seed!.gm.password);
    await table.openGame(state.agentServer!.url, state.seed!.gameId);
    await state.agent!.open();
    await state.agent!.ask("How will we cross the marsh?");
  },
);

Then(
  "the reply cites the saved entry and stays in the private GM chat",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect
      .poll(() => state.agent!.transcript.innerText())
      .toContain(
        "From “Ferryman contract”: Mara takes the party across the marsh at dawn for ten zenit.",
      );
    const toolCalls = (await this.page.getByTestId("agent-tool-call").allTextContents()).map(
      (text) => text.trim(),
    );
    expect(toolCalls).toContain("Tool · Searched the GM’s notes");
    expect(toolCalls).toContain("Tool · Read saved note entries");
    expect(toolCalls.join(" ")).not.toContain("zenit");
    const player = await this.browser!.newPage();
    try {
      const playerTable = new GameTablePage(player);
      await playerTable.signIn(
        state.agentServer!.url,
        state.seed!.player.username,
        state.seed!.player.password,
      );
      await playerTable.openGame(state.agentServer!.url, state.seed!.gameId);
      await player.getByTestId("party-list").waitFor();
      expect(await player.getByTestId("agent-chat-launcher").count()).toBe(0);
      expect(await player.content()).not.toContain("ten zenit");
    } finally {
      await player.close();
    }
  },
);

When("no saved note is relevant", async function (this: BrowserWorld) {
  await world.call(this).agent!.ask("What is the observatory password?");
});

Then(
  "the Agent explains that literal search found no relevant notes and semantic search is still indexing",
  async function (this: BrowserWorld) {
    const state = world.call(this);
    await expect
      .poll(() => state.agent!.transcript.innerText())
      .toContain("Literal search found no relevant notes. Semantic search is still indexing.");
    const transcript = await state.agent!.transcript.innerText();
    expect(transcript).not.toContain("Lighthouse ledger");
    expect(transcript).not.toContain("candles");
  },
);
