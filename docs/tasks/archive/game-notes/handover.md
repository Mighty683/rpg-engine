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

Implement complete journeys in `packages/tests` as a Gherkin feature with domain step definitions and page objects, following the [package guidance](../../../../packages/tests/AGENTS.md). Use deterministic fixtures where outcomes matter; drive the real frontend and backend. Review every scenario at 390 × 844 and 1280 × 800.

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

| Check                                      | Required coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API-01 — Access control                    | Anonymous and invalid-session requests return 401 on list, read, create and update. An account without membership gets 404 (indistinguishable from an unknown game). A player member gets 403 on all four operations and cannot write. Missing and foreign-game entry IDs both return 404 with no existence disclosure. Revoked membership loses access immediately. Rejected requests persist nothing.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| API-02 — List, search and paging           | Blank or missing `q` browses all entries ordered by `updatedAt DESC, id ASC`, at most 20 per page, `nextCursor` null on the last page. Cursor pages are stable with no duplicates and are scoped to the game and query: an invalid cursor, another game's cursor or another query's cursor returns 400. `q` matches case-insensitively as a literal substring of the title and visible body text, including across inline formatting boundaries and excluding the terminal newline.                                                                                                                                                                                                                                                                                                                                            |
| API-03 — Create and validation             | A valid create returns 201 at revision 1 with `createdAt`/`updatedAt` set and a persisted row including its `text_fingerprint`. A duplicate client ID returns 409 without changing the existing note; a retry with the same ID and different content also returns 409 and never overwrites. Unknown fields, unsupported operations and unsupported formats return 400; invalid attribute placement (header and list on one line), a missing terminal newline, a blank-after-trim or over-160 title, a body over 5,000 code points or over 64 KiB normalized return 422; a request over 96 KiB returns 413.                                                                                                                                                                                                                     |
| API-04 — Read by ID                        | The GM reads a saved entry regardless of any active search or page and gets the stored normalized document. Missing, foreign and player-accessed IDs behave as in API-01.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| API-05 — Update and optimistic concurrency | A PATCH at the current `expectedRevision` returns 200 with revision advanced by one, `updatedAt` advanced and `createdAt` unchanged. A stale revision returns 409 with the row unchanged. A normalized no-op returns 200 leaving `updatedAt` and revision unchanged. A text-changing save updates the persisted `text_fingerprint`; a formatting-only save advances the revision without touching the fingerprint. `changes` requires at least one of `title` or `content`. Verify all persisted effects.                                                                                                                                                                                                                                                                                                                      |
| API-06 — Write guards and privacy          | POST and PATCH without a valid Origin or session-bound CSRF token return 401. The 96 KiB request limit still applies (413). Note titles, bodies and search queries never appear in event streams, player projections or logs; assert no note payload reaches the events stream.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| API-07 — Agent note tools                  | Drive `POST /games/{gameId}/agent/turns` with a deterministic provider that calls the tools. `search_notes` trims and bounds its query (1–512, limit 1–10, default 5, unknown properties rejected), returns at most one match per entry with literal matches first and `semanticStatus` computed from the passage fingerprint join (`ready`, `indexing`, `unavailable`), and returns valid literal matches even when semantic is incomplete. `get_notes` accepts 1–3 unique IDs and returns full plain-text bodies, with missing and foreign IDs indistinguishable in `missingEntryIds` and no entry data. Both tools recheck current-GM access at execution and fail as a tool error, never an empty search, for players; tool labels and logs contain no note text or queries. The tools are read-only: no note rows change. |

## Prototype comparison checks

Compare the delivered production routes — table drawer, `/games/:gameId/notes`, `/games/:gameId/notes/new` and the entry detail state — against the approved [prototype](../../../../packages/frontend/prototypes/game-notes/GameNotes.story.vue) at 390 × 844 and 1280 × 800. Cover the consequential states: drawer open, loading, empty notebook (“No entries yet”), no search match, failed-save recovery toast, and an entry with formatted content in the drawer, results and detail. Record the comparison and the required check results for the delivered revision below before archiving.

### Wave 2 comparison (2026-11-20)

Production components were ported from the approved prototype (NoteCard, NoteBody, NoteEditor, entry fields, drawer and screen layout reuse the same markup, classes and tokens), so the comparison below is DOM-evidence based: for each state I captured element geometry, computed styles, toolbar inventory and visible text from the production routes (a disposable backend seed at both review sizes) and from the built prototype gallery for the shared story states, with screenshots archived under the run workspace (`notes-compare/production-*` and `notes-compare/gallery-*`, 10 states each per size; this session recorded geometry rather than eyeballing images).

- **Drawer open (both sizes).** Identical geometry and chrome: the panel renders inside the same right-edge `role="dialog"` (1280×800: panel x=856, y=88, w=400 on both; card width 400 and card title 16px on both), the Game notes edge tab is `aria-pressed="true"`, all other rail tabs hide while it is open, and “Search all entries” is the same underlined link in both. At 390×844 both show 358-wide cards. Discrepancy (deliberate, spec-driven): the prototype drawer renders three seeded cards; the production drawer renders the full first page (a maximum of 20) and appends pages on scroll per ux.md, so panel heights differ with data volume.
- **Loading.** Both render the same `ContentState` loading listing (“Loading entries…”) in the drawer and notes list; production adds `data-testid` hooks (for example `notes-loading`) that the prototype does not have.
- **Empty notebook.** Both show the same “No entries yet.” copy in the drawer and results (production checked against a second game with an empty notebook). The two empty states remain distinguishable from “No matching entries.” as specified.
- **No search match.** Identical: the same “No matching entries.” empty state, with the entered search term retained in the field (verified “observatory” on both sides).
- **Formatted content in drawer, results and detail.** Identical card anatomy (title, both dates in `Created … · Updated …` form, fixed-element body with the same heading/list/strong/em/u/s rendering, no editor toolbar in cards). The formatted entry shows the same inline and block formatting at both sizes. The editor toolbar inventory is identical: Normal text plus headings 1–3, bulleted and numbered lists, bold, italic, underline, strikethrough and Clear formatting (aria-labels match one-for-one); production additionally carries stable test IDs on the style select and buttons (E2E affordance, visual no-op).
- **Entry detail.** Same “Back to results” control, same labeled title field (maxlength 160), same body editor and the same metadata line format.
- **Failed-save recovery toast.** Production shows the spec’d recovery toast “Could not save this entry. Your text is available in the editor.” with an explicit “Retry edits” action while the draft stays editable (captured in `08-failed-save-recovery-toast`). The gallery provides no per-request failure injection; its “Error” story control fails every request, so the comparable captured state is the create-failure toast “Could not create the entry. Your draft is still here.” (`10-gallery-failed-create-recovery-toast`). The wording, error color, retained draft and absence of any red inline error match; the production Retry action on entry saves is a deliberate Wave 2 addition from the UX spec.
- **New entry screen.** Production shows the same “New entry” heading, reused `EntryFields`/toolbar and `FormActions` (“Cancel”, “Create entry”) as the prototype; the prototype parity for the form flow itself is additionally guaranteed by the unchanged `GameNotes.browser.ts` regression, which stays green.
- **Host note for the 390 gallery evidence.** The Histoire canvas hosts the story inside its own chrome; the 390×844 gallery captures re-size the story canvas rather than the window, so gallery drawer coordinates are host-relative. Card geometry (358-wide, 16px titles) and all content comparisons remain equal at 390.

Conclusion: the delivered routes match the approved prototype in structure, styling, tokens, typography and state copy at both review sizes; the observed differences are the specified production behaviors (cursor paging with load-more, 2-second idle autosave, explicit retry in the recovery toast, player unavailable screen) plus added test affordances.

### Wave 4 visual review (2026-11-20)

Rebuilt the gallery and compared complete Chromium viewport captures at **390 × 844 and 1280 × 800**. Opened the Histoire sandbox directly at each size, so no gallery sidebar obscures the screen. Reran production against the isolated dev setup below. Used the same synthetic formatted body (heading, bold, italic and bullet) on both sides; the gallery's browser harness adjusted only note HTTP responses for the shared content fixture, empty/loading states and an interrupted PATCH. Production used persisted fixtures, a delayed real list request and an aborted PATCH. Full PNGs, per-state DOM/geometry, and paired review sheets are in `/tmp/opencode/notes-wave4/` (`gallery-*`, `production-*`, `review-*.png`). This visual review supersedes the Wave 2 parity conclusion above.

| State                                | Observed at both sizes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drawer loading, open and empty       | Same ordering of title, close control, search link and content; loading and empty copy match. Both loaded captures have cards, not placeholders. First card widths match (358 px mobile, 400 px desktop). Production includes the collapsed Agent launcher and a heading divider absent from the notes story; font wrapping raises the first mobile card from 126 to 146 px.                                                                                                                                                                                                                                                                                                                                                                       |
| Results, no match and empty notebook | Matching search control and distinct no-match/empty copy; formatting and two dates render in cards without an editor toolbar. Production's signed-in shell moves content down, with wider results (358 vs 342 px mobile, 1152 vs 1104 px desktop) and visibly different font metrics.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Formatted detail and new entry       | Same editor control inventory, field labels, formatted hierarchy and form actions. Gallery detail leaves the search field above the editor; production hides it and shows **Back to results**. Application navigation and spacing differ on both views.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Failed save                          | Both show the same error wording and **Retry edits**, with the unsaved title still in the editor. This is now a like-for-like interrupted update, not a create-failure substitute.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Agent chat open                      | Compared against the separate [Agent story](../../../../packages/frontend/prototypes/ai-provider-configuration/AgentEdgeTab.story.vue), which has a mock party conversation, not notes retrieval. Both place the chat at the bottom-left with the same 360 px panel width; production panel rect is `[12,462,360,370]` mobile and `[12,418,360,370]` desktop, vs `[12,461,360,371]` and `[12,417,360,371]` in the gallery. The input and Send are in the viewport at both sizes. Production shows the real table shell and notes tab behind the panel. The application with deterministic providers showed the saved note title and answer and the two generic note-tool labels; the no-match turn was tested separately from the gallery comparison. |

This confirms the listed states and shared structure, **not pixel/typography parity**. The application shell, fixture data, detail search visibility, and font/spacing differences above are visible in the paired evidence.

## Database verification

**Wave 4 (2026-11-20):** Followed [tech.md — Database](tech.md#database) on a separate disposable Podman PostgreSQL 17 instance. Applied 001–013 from a temporary copy of the Drizzle journal, then ran `pnpm seed:demo` without `--reset`. Pre-migration data included one game, two accounts, one player, two characters, class and skill progression, and three NPCs and attacks. The deployer installed `vector` 0.8.7; the non-superuser schema owner (with database `CREATE` for Drizzle) ran the real `pnpm --filter @rpg-engine/backend migrate` and applied runtime grants. The ledger grew from 13 to 15 migrations. Counts and sorted row-content digests matched for all 22 pre-existing application tables; the existing game had zero notes and the new passage table had zero rows.

- As `rpg_runtime`, the application logged in as the demo GM, listed the empty notebook, created an entry (201, revision 1), updated it (200, revision 2, unchanged creation time), and read it back (200, exact match with the update). The application passage store rejected a stale fingerprint and replaced an existing passage set; reading back as `rpg_runtime` returned only the replacement with the current fingerprint and a 1,024-dimensional vector. Entry `DELETE` and `CREATE EXTENSION hstore` were both denied with SQLSTATE `42501`. The runtime role had no schema `CREATE`, superuser, database-creation or role-creation privilege.
- No destructive reset was run in Wave 4. The earlier isolated reset check verified that the reset command recreated `vector`.

## Verification evidence

**Interim evidence (2026-11-20; final acceptance pending):**

- `pnpm test:integration` provisioned pgvector in a disposable PostgreSQL 17 container. Backend and migration checks passed (20 tests), as did the cross-module API suite (77 tests). The latter does not yet include API-07.
- The same run passed 40 browser cases and failed seven: six Game Notes cases (search/paging, autosave, recovery, and rich-text paste) and one Class Management timeout. All seven Class Management cases passed in an isolated rerun. Game Notes fixes and a clean integrated rerun are pending.
- Separate disposable database checks verified entry read/create/update and passage replacement for `rpg_runtime`, while entry deletion and extension installation were denied. The isolated reset check recreated the extension. Recheck the populated-data transition and grants on the integrated revision.
- The semantic cutoff of `0.7` was exercised with deterministic vectors. Calibration with representative GM questions against live Mistral embeddings remains pending; no provider key was available for this run.

**Wave 4 integrated verification (2026-11-20):** Ran `pnpm verify` with `TEST_DATABASE_URL` unset so the runner provisioned its own disposable Podman PostgreSQL 17 + pgvector. Formatting/type checks and OpenAPI lint/bundle passed; both builds passed. Results: 375/375 unit and contract tests, 35/35 frontend browser tests, 20/20 backend database/migration tests, and 79/79 cross-module API tests. The two-worker containerized E2E run passed 47/49 (Game Notes 13/13, including E2E-07 at both sizes), so `pnpm verify` exited 1. Both failures were 15-second Cucumber timeouts in Class Management E2E-03 (Remove a learned skill, 1280 and 390), at the final step asserting that the game class is absent from the catalog and class picker after reload. Against the separate disposable pgvector database, the isolated Class Management rerun passed 7/7 and the host run of `pnpm --filter @rpg-engine/tests test --run --maxWorkers=1` passed **49/49** (9/9 files, 412 seconds). Both reruns exited 0; this establishes a clean serial run, not a clean two-worker container run. Logs are in `/tmp/opencode/notes-wave4/` (`verify.log`, `class-isolated.log`, `browser-serial.log`).

**Final integrated verification (2026-11-20):** Added 390 × 844 examples for autosave, recovery and player privacy. All 16 Game Notes cases now run at both review sizes. The integration runner uses one browser worker in both host and container modes. With `TEST_DATABASE_URL` unset, `pnpm verify` passed against disposable PostgreSQL 17 + pgvector: 375 unit and contract tests, 35 frontend browser tests, 20 backend database and migration tests, 79 API integration tests, and 52 browser E2E cases. Log: `/tmp/opencode/notes-final-verify.log`.

**Wave 4 dev smoke (2026-11-20):** Started the root `pnpm dev` command against the separate disposable database with the restricted login, loopback Vite on 5173, backend on 43191, and Agent disabled. Both listeners came up; direct `/openapi.json` and `/api-docs/` returned 200. Signed in using the frontend origin and verified the notes CRUD and revision checks above through Vite's same-origin API proxy. No provider credentials were needed for this check.

**Pending release check for semantic lookup (owner: requester):** No Mistral API key was available for automated verification. No real notes were sent to an external service. The `0.7` cosine cutoff has deterministic integration coverage but is not calibrated against `mistral-embed`. Before shipping semantic lookup, use synthetic GM notebook examples with known answers (including paraphrases) and no-match questions, verify that relevant passages clear the cutoff and ranked unrelated passages do not, then record the measured cutoff. This does not block literal retrieval or implementation archival.

**Agent fallback follow-up:** The `search_notes` instructions now distinguish empty `ready`, `indexing`, and `unavailable` results, and direct the GM to **Search all entries** when semantic search is unavailable. The deterministic provider mirrors those branches. The focused E2E-07 rerun passed at both sizes (2/2), verifying that the browser shows a qualified no-match reply while indexing and does not cite unrelated notes. This does not verify live-model wording or relevance.
