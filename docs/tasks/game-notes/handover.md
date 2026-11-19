# Game notes — handover

**Created:** 2026-11-19
**Sources:** [Story](story.md) · [UX and prototype design](ux.md) · [Technical design](tech.md) · [OpenAPI contract](openapi.yaml)

## Goals

- A signed-in GM has a private per-game notebook with rich-text entries: create, browse, read, search and autosave entries without losing typed text.
- Recent entries are reachable from the game table in a right-edge drawer; the notes screen (`/games/:gameId/notes`, `/games/:gameId/notes/new`) carries browse, literal search and entry detail.
- Search is a case-insensitive literal match over title and visible body text across the whole notebook, newest first, with cursor paging and load-more on scroll.
- Saves are optimistic with a 2-second idle autosave; failed, uncertain or conflicting writes keep an editable draft and reconcile against the saved entry on explicit retry.
- The Agent answers GM questions from saved notes in the game's private chat through the read-only `search_notes` and `get_notes` tools.
- Players never see GM notes: no notes tab or drawer at the table, an unavailable screen on direct note routes, 403/404 on the API, and no note data in player projections, event streams or logs.

Unit and component coverage is decided alongside the code during implementation. This handover scopes only browser E2E and API integration tests in `packages/tests`.

## Browser E2E tests

Implement complete journeys in `packages/tests` as a Gherkin feature with domain step definitions and page objects, following the [package guidance](../../../packages/tests/AGENTS.md). Use deterministic fixtures where outcomes matter; drive the real frontend and backend. Review every scenario at 390 × 844 and 1280 × 800.

```gherkin
Feature: Game notes

  Scenario: E2E-01 — Consult recent entries from the table drawer
    Given a GM has a game with saved note entries at the table
    When the GM opens the Game notes EdgeTab
    Then the drawer shows the newest entries first with title, content and both dates
    When the GM scrolls the drawer
    Then older entries load in order without losing the loaded cards
    When the GM selects an entry card
    Then the entry detail opens on the notes screen
    When the GM dismisses the drawer with Escape or the close button
    Then the table is restored at the same position with no unsaved-changes prompt

  Scenario: E2E-02 — Capture and reopen an entry
    Given a GM is on the notes screen of a game
    When the GM opens New entry, enters a title and formatted body, and creates the entry
    Then a toast confirms and the saved entry detail opens with both timestamps
    When the GM reloads the page
    Then the entry is still there with the same saved content
    When the GM cancels a new entry
    Then the notes list shows again and the draft is preserved for the same game

  Scenario: E2E-03 — Search the whole notebook and browse newest first
    Given a GM has several saved entries in a game
    When the GM opens Search all entries with a blank query
    Then all entries are listed newest first, distinct from the empty-notebook state
    When the GM searches a phrase inside an entry body, ignoring case
    Then the matching entries are listed and a non-matching query shows the no-match state
    When the GM changes the query
    Then the result list resets to the first page
    When the GM scrolls the results
    Then the next page appends below the loaded cards and stops at the end
    When the GM selects a result by click or Enter on the focused title
    Then the entry detail opens, and Back to results keeps the search term

  Scenario: E2E-04 — Edit an entry with autosave
    Given a GM has an entry detail open
    When the GM edits the title or body
    Then the change shows immediately and saves after 2 seconds idle, even while focused
    When the GM leaves the field with a pending change
    Then the pending change flushes immediately
    Then the list and metadata refresh from the server acknowledgement with local-time dates

  Scenario: E2E-05 — Recover a failed or conflicting save
    Given a GM is editing an entry whose save fails or returns an uncertain response
    Then the GM gets a recovery toast and the typed draft stays editable
    When the GM explicitly retries
    Then the retained text is reapplied only onto the refreshed server version
    When a save is confirmed rejected
    Then the view restores the acknowledged result

  Scenario: E2E-06 — Keep notes private from players
    Given a GM has saved notes and a player has the same game open
    Then the player's table has no Game notes tab or drawer
    When the player visits the notes routes directly
    Then an unavailable screen appears with a route back and no notes request is made

  Scenario: E2E-07 — Ask the Agent from saved notes in private chat
    Given a GM has a saved entry with an established detail
    When the GM asks the Agent a question answerable from that entry in the game's private chat
    Then the reply cites the source entry and stays in the private GM chat
    When no saved note is relevant
    Then the Agent says it found no relevant notes instead of citing an unrelated entry

  Scenario: E2E-08 — Format and paste within the allowlist
    Given a GM is creating or editing an entry
    When the GM applies headings, lists, bold, italic, underline and strikethrough, and clears formatting
    Then the toolbar offers only those controls and paste keeps only supported text and formatting
    When the GM views the entry in the drawer or results
    Then the card renders the supported formatting without an editor toolbar
```

## API integration tests

Implement in `packages/tests/src/api/game-notes.integration.test.ts` against PostgreSQL with the shared API fixture. Assert response projections and persisted effects with `readPersistedState` and direct pool queries; rejected writes leave `game_note_entries` and `game_note_passages` unchanged.

| Check | Required coverage |
| --- | --- |
| API-01 — Access control | Anonymous and invalid-session requests return 401 on list, read, create and update. An account without membership gets 404 (indistinguishable from an unknown game). A player member gets 403 on all four operations and cannot write. Missing and foreign-game entry IDs both return 404 with no existence disclosure. Revoked membership loses access immediately. Rejected requests persist nothing. |
| API-02 — List, search and paging | Blank or missing `q` browses all entries ordered by `updatedAt DESC, id ASC`, at most 20 per page, `nextCursor` null on the last page. Cursor pages are stable with no duplicates and are scoped to the game and query: an invalid cursor, another game's cursor or another query's cursor returns 400. `q` matches case-insensitively as a literal substring of the title and visible body text, including across inline formatting boundaries and excluding the terminal newline. |
| API-03 — Create and validation | A valid create returns 201 at revision 1 with `createdAt`/`updatedAt` set and a persisted row including its `text_fingerprint`. A duplicate client ID returns 409 without changing the existing note; a retry with the same ID and different content also returns 409 and never overwrites. Unknown fields, unsupported operations and unsupported formats return 400; invalid attribute placement (header and list on one line), a missing terminal newline, a blank-after-trim or over-160 title, a body over 5,000 code points or over 64 KiB normalized return 422; a request over 96 KiB returns 413. |
| API-04 — Read by ID | The GM reads a saved entry regardless of any active search or page and gets the stored normalized document. Missing, foreign and player-accessed IDs behave as in API-01. |
| API-05 — Update and optimistic concurrency | A PATCH at the current `expectedRevision` returns 200 with revision advanced by one, `updatedAt` advanced and `createdAt` unchanged. A stale revision returns 409 with the row unchanged. A normalized no-op returns 200 leaving `updatedAt` and revision unchanged. A text-changing save updates the persisted `text_fingerprint`; a formatting-only save advances the revision without touching the fingerprint. `changes` requires at least one of `title` or `content`. Verify all persisted effects. |
| API-06 — Write guards and privacy | POST and PATCH without a valid Origin or session-bound CSRF token return 401. The 96 KiB request limit still applies (413). Note titles, bodies and search queries never appear in event streams, player projections or logs; assert no note payload reaches the events stream. |
| API-07 — Agent note tools | Drive `POST /games/{gameId}/agent/turns` with a deterministic provider that calls the tools. `search_notes` trims and bounds its query (1–512, limit 1–10, default 5, unknown properties rejected), returns at most one match per entry with literal matches first and `semanticStatus` computed from the passage fingerprint join (`ready`, `indexing`, `unavailable`), and returns valid literal matches even when semantic is incomplete. `get_notes` accepts 1–3 unique IDs and returns full plain-text bodies, with missing and foreign IDs indistinguishable in `missingEntryIds` and no entry data. Both tools recheck current-GM access at execution and fail as a tool error, never an empty search, for players; tool labels and logs contain no note text or queries. The tools are read-only: no note rows change. |

## Prototype comparison checks

Compare the delivered production routes — table drawer, `/games/:gameId/notes`, `/games/:gameId/notes/new` and the entry detail state — against the approved [prototype](../../../packages/frontend/prototypes/game-notes/GameNotes.story.vue) at 390 × 844 and 1280 × 800. Cover the consequential states: drawer open, loading, empty notebook (“No entries yet”), no search match, failed-save recovery toast, and an entry with formatted content in the drawer, results and detail. Record the comparison and the required check results for the delivered revision below before archiving.

## Database verification

Pending implementation. Follow the preparation instructions in [tech.md — Database](tech.md#database) on a populated disposable database: provision `pgvector` with `CREATE EXTENSION IF NOT EXISTS vector;` as a deployment role, apply migrations 014 and 015 as the schema owner with `pnpm --filter @rpg-engine/backend migrate`, extend `packages/backend/scripts/runtime-grants.sql` with SELECT/INSERT/UPDATE on `game_note_entries` and SELECT/INSERT/DELETE on `game_note_passages` (deliberately no DELETE on entries), and verify with the restricted `rpg_runtime` login that the application can read, create and update entries and replace passages but cannot delete entries or install extensions. Confirm existing games start with empty notebooks and no existing table data changes, and that `pnpm seed:demo --reset` recreates the extension after dropping the schema. Record results below.

## Verification evidence

Pending implementation and test execution.

- Browser E2E: `pnpm --filter @rpg-engine/tests test` with `TEST_DATABASE_URL` set to a disposable PostgreSQL database.
- API integration: `pnpm --filter @rpg-engine/tests test:api` against the same disposable database.
- Prototype comparison at both review sizes and all states listed above.
- Database verification per the section above.
