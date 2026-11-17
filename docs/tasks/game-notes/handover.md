# Game notes — handover

**Prepared 2026-11-17.** [Story](story.md) · [UX and gallery walkthrough](ux.md) · [Technical design and database preparation](tech.md) · [API contract](openapi.yaml)

## Acceptance

A GM can read recent entries in a drawer over the table and open the separate notes screen to record a titled, multiline entry, resume play and find the entry later on that game's notes page. Search covers the full title and content. Reading or revising an entry shows both dates. Creation survives retry and refresh. Subsequent edits preserve the creation date and advance the update date only for a real change. Players and other games cannot access the notebook.

## Browser E2E — packages/tests

Use Gherkin features, domain steps and page objects with data-testid selectors. Run the full application against an isolated TEST_DATABASE_URL. Name the game and entry in steps. Coverage below follows [package guidance](../../../packages/tests/AGENTS.md).

```gherkin
Scenario: NOTES-E2E-01 Capture during play and find the entry after reload
  Given the GM runs Lantern Road and Salt Coast and both notebooks are empty
  When the GM selects the Game notes EdgeTab on the Lantern Road table
  Then a Game notes drawer opens over the table at the same URL
  When the GM dismisses the drawer
  Then the Lantern Road table is still open at its previous position
  When the GM reopens the drawer, chooses Search all entries
  And opens New entry on the notes screen and enters content without a title
  And the GM submits the entry
  Then the dialog keeps the content and asks for a title in a toast
  When the GM enters "Mara's price" and creates the entry
  Then the new entry opens in detail
  When the GM follows the game name back to the Lantern Road table
  Then the party and roll controls are visible
  When the GM selects the Game notes EdgeTab on the table
  Then the drawer shows "Mara's price", its content and both dates together in a card
  When the GM chooses Search all entries, reloads and searches for a mixed-case word deep in the content
  Then the matching result opens with the full text and equal creation and update dates
  When the GM returns to the table and opens Salt Coast's Game notes
  Then Salt Coast shows its empty notebook

Scenario: NOTES-E2E-02 Revise an entry and recover it through search
  Given the GM has two dated entries in Lantern Road
  When the GM finds the older entry by title, changes its title and multiline content, and returns to results
  Then the old title query shows no matches
  When the GM clears the query and reloads Game notes
  Then the edited entry appears first with its new text and original creation date
  And its update timestamp has advanced
  And the second entry retains its text and dates

Scenario: NOTES-E2E-03 Open a notes link as a player
  Given a player participates in Lantern Road and its GM has a private entry
  When the player opens the Lantern Road table and then visits its notes URL directly
  Then the table offers no note actions and the notes page reveals no entry text
  And the player can return to the Lantern Road table

Scenario: NOTES-E2E-04 Recover from a stale edit
  Given the GM has the same Lantern Road entry open in two tabs
  When the GM commits a change in the first tab and edits the older version in the second
  Then the second tab shows a recovery toast and keeps the local text available
  And reopening the entry independently shows the first tab's committed version
  When the GM explicitly retries the retained edit against the refreshed revision
  Then reopening the entry shows the retried text

Scenario: NOTES-E2E-05 Capture from the notes page
  Given the GM is on the empty Lantern Road notes page
  When the GM opens New entry, types a title, closes the dialog and reopens it
  Then the draft title is still present
  When the GM creates the title-only entry
  Then its detail opens with both dates and empty content
  And returning to results shows exactly one matching entry
```

## API integration — packages/tests/src/api

Exercise authenticated HTTP with real CSRF/session handling and inspect durable state after writes. Use valid CSRF for permission tests to isolate the intended boundary.

| ID | Input and expected persisted effect |
| --- | --- |
| NOTES-API-01 | Signed-out list and writes with otherwise valid requests return 401. Player list/create/PATCH return 403. An outsider gets 404 for the game. Bodies contain no private note text; row counts, text and revisions stay unchanged. |
| NOTES-API-02 | A GM who owns A and B supplies B's entry ID under A. PATCH returns 404. Listing A omits B's entry. Extra gameId or timestamp fields in a valid write envelope get rejected. Re-read both games to verify isolation. |
| NOTES-API-03 | Missing/invalid CSRF or disallowed Origin on create and PATCH returns 403 without a write. Malformed IDs/envelopes return 400; valid envelopes with blank/overlong title or overlong content return 422. Empty PATCH changes are rejected. Assert unchanged row count and revision. |
| NOTES-API-04 | Race two creates with the same game and UUID. Exactly one returns 201 and one returns 409. Retrying that ID with different text also returns 409. Re-read one row with the winning text, revision 1 and equal dates. |
| NOTES-API-05 | Race two different edits at the same expected revision. One succeeds and one gets 409. Re-read the winner's complete text, original createdAt, advanced updatedAt and a single revision increment. A current-revision no-op keeps both revision and dates. |

## Production comparison and release evidence

| Check | Required evidence | Status |
| --- | --- | --- |
| NOTES-UI-01 | Compare table, recent-entries drawer, creation dialog, list, editor and return path on the production routes against Histoire at 390 × 844 and 1280 × 800. Verify that Game notes appears in the existing right-edge rail and New entry appears only on the notes screen. Check the shared SurfaceCard styling and the underlined Search all entries navigation link. Check header context, wrapping, field visibility, dark tokens, keyboard focus, scroll, empty/no-match/loading/retry states and toast recovery. Record screenshots or links and any accepted differences. | Pending |
| NOTES-DB-01 | Apply the migration to a populated disposable database and re-run it. Verify existing games, characters and memberships survive, old notebooks are empty, schema/index/constraints match the design and normal demo seeding still works. Exercise list/create/update through the restricted runtime role and confirm it cannot delete note rows. | Pending |
| NOTES-E2E-01–05, NOTES-API-01–05 | Record delivered revision, commands, results, failures and outstanding items. Use the real production routes and persisted data. | Pending |

The browser prototype check is separate from production acceptance. Archive the complete task only after implementation, recording the delivered revision and verification evidence.
