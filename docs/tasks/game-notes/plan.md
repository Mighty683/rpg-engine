# Game notes — implementation plan

**Created:** 2026-11-19 · [Handover](handover.md) · [UX and prototype](ux.md) · [Technical design](tech.md) · [OpenAPI](openapi.yaml)

Acceptance and required checks are defined in the [handover](handover.md). Build the four waves in order, **one sub-agent per wave**; each owner starts from the preceding integrated revision, owns the listed paths, accommodates existing edits and never reverts them. Planning does not dispatch agents. The implementation lead owns shared contract decisions and cross-wave integration. Unit coverage is decided alongside implementation.

| Wave and owner | Depends on | Checks the owner implements and runs |
| --- | --- | --- |
| 1 · Notebook persistence and HTTP | Existing game access, transactions and middleware | API-01 through API-06; entries database verification |
| 2 · Production notes UI | Wave 1 HTTP contract; approved prototype | E2E-01 through E2E-06, E2E-08; prototype comparison on the notes routes |
| 3 · Agent retrieval and semantic index | Wave 1 entries and fingerprints; Wave 2 feature file for E2E-07 steps | API-07, E2E-07; passages database verification; cutoff calibration |
| 4 · Integrated verification | Waves 1 through 3 | Rerun all suites; complete prototype comparison; database verification; evidence and archive |

Wave 3's only hard dependency is Wave 1: its backend half may proceed in parallel with Wave 2, bounded by the edit boundaries below, but its additions to the shared test files land after Wave 2's.

## Wave 1 — Notebook persistence and HTTP API

**Owner: Wave 1 sub-agent.**

| Edit boundary | Work | Depends on | Handover checks |
| --- | --- | --- | --- |
| `packages/backend/src/modules/game-notes` (schema, contract, service, controller, types), `drizzle/014_game_note_entries.sql` and journal, `runtime-grants.sql`, canonical backend OpenAPI with Ajv parity, `app.ts` composition | Implement game-scoped entries: access-first 403/404 checks, cursor paging (`updatedAt DESC, id ASC`, 20 per page, per-game and per-query cursors), case-insensitive literal search over title and visible body text, client-generated IDs, revision and optimistic-concurrency rules, canonical server-side Delta normalization with the code point and size limits, and `text_fingerprint` written on create and text-changing saves. Fold the proposed operations into the canonical OpenAPI and extend `schema-contract.test.ts` parity. | Games access capability, transaction-bound services, existing middleware | API-01, API-02, API-03, API-04, API-05, API-06 |
| `packages/tests/src/api/game-notes.integration.test.ts` | Implement the integration suite against PostgreSQL with the shared fixture: access matrix, search and paging semantics, create validation (409/400/422/413), reads, revision and fingerprint effects, write guards, and no note data in events or projections. Assert persisted effects; rejected writes change nothing. | Backend module complete | Same checks, executed |
| Entries database verification | On a populated disposable database: apply migration 014 as schema owner, extend `runtime-grants.sql` (SELECT/INSERT/UPDATE on entries, deliberately no DELETE), verify with the restricted runtime login that the app can create and update entries, and confirm existing games keep their data with empty notebooks. Preparation per [tech.md — Database](tech.md#database). | Migration 014 and grants | Database verification, entries portion |

## Wave 2 — Production notes UI at the table

**Owner: Wave 2 sub-agent.**

| Edit boundary | Work | Depends on | Handover checks |
| --- | --- | --- | --- |
| `packages/frontend/src/modules/game-notes` (views, controller, adapter, types) plus router and `ApiServices` registration in `main.ts`, AgentTable panel tab, shared editor extraction | Move `visibleNoteText`, `sameNoteDocument` and the code point limit from the prototype into production with parity coverage. Share the Quill editor across create and detail with the toolbar and paste allowlist; no `v-html`. Implement the controller with game-and-entry-scoped drafts and save queues, `useOptimisticSave` with 2-second idle autosave and flush on field exit, write recovery and explicit retry, superseded-response guarding, state clearing on sign-out, access loss and game switch. Build the drawer (paginated recent entries), notes screen with search and load-more, new entry page with cancel-preserves-draft, entry detail state, and the player unavailable screen for direct visits. | Wave 1 contract; approved prototype | E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, E2E-08 |
| Notes browser feature, steps and page objects in `packages/tests` | Implement the Gherkin scenarios with domain page objects, driven through the real frontend and backend. | Production routes wired | Same checks, executed |
| Prototype comparison on production routes | As soon as `/games/:gameId/notes` renders, compare the complete drawer, notes, new entry and detail screens against the approved prototype at 390 × 844 and 1280 × 800 across drawer, loading, empty-notebook, no-match, failed-save and formatted states. Record the comparison and discrepancies in the handover. | Production views | Prototype comparison, notes routes |

## Wave 3 — Agent retrieval and semantic index

**Owner: Wave 3 sub-agent.**

| Edit boundary | Work | Depends on | Handover checks |
| --- | --- | --- | --- |
| `drizzle/015_game_note_passages.sql` and journal, `runtime-grants.sql` passage grants, embedding client next to the chat provider, indexing scheduler and startup sweep in the notes module, `agent-reads.ts` registration, `AgentDependencies` composition in `app.ts`, `seed:demo --reset` extension step | Provision pgvector, add the passage store with fingerprint-gated atomic replacement, passage splitting at heading boundaries (800 code points, 200 overlap, title included), the 60-second per-note cooldown scheduler with skip and recheck, and the startup sweep as backfill. Register `search_notes` and `get_notes` with execution-time access rechecks, turn reauthorization, `semanticStatus` computed from the fingerprint join, and no note text in labels or logs. | Wave 1 entries and fingerprints | API-07, E2E-07 |
| `packages/tests` additions to the Wave 1 integration file and the Wave 2 feature file | Add API-07 coverage with a deterministic provider through the agent turn endpoint, and E2E-07 chat steps citing saved entries. Accommodate existing steps; never revert them. | Waves 1 and 2 test files | Same checks, executed |
| Cutoff calibration and passages database verification | Calibrate the cosine cutoff with representative GM questions with known answers and no-match questions; record the chosen value in the handover; literal retrieval is unaffected. Apply migration 015 as schema owner after `CREATE EXTENSION IF NOT EXISTS vector;`, verify restricted-role passage replacement and no entry deletes, and that `seed:demo --reset` recreates the extension. | Passage ranking; migration 015 | Cutoff decision recorded; database verification, passages portion |

## Wave 4 — Integrated verification and handover

**Owner: Wave 4 sub-agent.**

| Edit boundary | Work | Depends on | Handover checks |
| --- | --- | --- | --- |
| Cross-cutting fixes surfaced by combined runs, handover evidence, summary status, archive move | Rerun both suites combined on a disposable database, redo the prototype comparison including the Agent chat state at both sizes, and replay database verification on the integrated revision. Record evidence, failures and open items in the handover; set the summary status to Implemented and archive the task per the handover skill, preserving outstanding verification and open items. | Waves 1 through 3 | All checks rerun; evidence recorded |

~~~sh
pnpm check
pnpm --filter @rpg-engine/tests test:api --run
pnpm --filter @rpg-engine/tests test --run
~~~

Run API integration and browser suites with `TEST_DATABASE_URL` set to a disposable PostgreSQL database.
