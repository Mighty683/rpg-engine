# Private rolls — technical design

**Created:** 2026-11-12

## Current situation

`throws/service.ts` stores immutable snapshots with an account author, assigns a game-wide sequence under the game lock, and lists every non-deleted throw to every member. Both `loadSource` and the separate NPC source lookup in `npc-resolve.ts` retrieve by game and ID without an audience check. Removal allows the GM or author, including an early success for already-deleted rows. All writes broadcast a game-wide `throws` hint. `ThrowRecord.seq`, the numeric `before` cursor and frontend history merging expose game-wide sequence gaps. Those gaps would reveal hidden activity even if the list were filtered.

`GameTable.vue` owns the roll drafts and uses injected game-table services; `RollDialog.vue` and `FreeRollDialog.vue` render setup, while `HistoryPanel.vue` and `ThrowResultCard.vue` render history. `GameView.vue` invalidates account-scoped history queries on SSE hints. `hooks.ts` loads pages and `history.ts` orders and detects gaps by sequence. Production OpenAPI is maintained in `packages/backend/openapi/openapi.yaml`. Relevant existing coverage includes `packages/tests/src/api/game-table.integration.test.ts`, `packages/backend/src/modules/events/streams.test.ts`, and frontend game-table history and browser tests.

## Decisions and contract

A private throw belongs to the authenticated account that submits it, independent of character attribution, current role and NPC visibility. A current game member may read public throws and their own private throws; this rule applies to the GM too. Membership remains a prerequisite. Visibility is immutable after creation. Rerolls are new throws, authored by the caller; the caller may choose the new visibility only after being authorized to read the source. Existing role, character and NPC roll restrictions still apply.

Use a `private` boolean, defaulting to `false` when omitted for compatibility with existing create clients. Validate its type and reject unknown fields as today. The response returns `private` for every visible throw; it never needs to expose the author's account ID. The [proposed OpenAPI 3.1 contract](openapi.yaml) describes the affected HTTP operations, errors, and deliberate pagination break. Update the production OpenAPI alongside implementation.

Public-by-default, the ability to change visibility on reroll, and hiding the existence of private activity are carried forward as untested UX proposals. There is no approved prototype: the user explicitly requested documentation without one, so production components are the integration target.

## Persistence and authorization

Add a non-null boolean column with `false` default to `throws` and a migration that preserves all existing entries as public. Extend Drizzle fields, row and contract types. Persist privacy and the server-derived `actor.accountId` in the same transaction as the resolved snapshot; never accept an author from the client. Keep the existing game lock, immutable snapshot and internal game sequence. Check query plans before adding an index: the existing game/sequence partial index may suffice, and any new index must support filtering public or own records before the page limit.

Centralize the visible-row predicate: same game, and public or author equals the authenticated account. Apply it in the database **before** ordering and limiting history, and to every source lookup, including NPC rerolls and their previous snapshots. For a missing, deleted or inaccessible source, return the same 404. For removal, check visibility before deleted/idempotent handling and before the existing GM/author permission check; an inaccessible private ID returns the same 404 as an absent ID, including for GMs. A visible public throw by another player still follows existing removal rules. Recheck access within the existing transaction to prevent revocation races.

## Pagination and activity privacy

Keep the sequence solely as a server-side ordering key. Remove `seq` from the HTTP record and replace numeric `before` with the UUID of an earlier visible throw. Resolve the anchor to its internal sequence scoped to the game and the same visibility predicate, then query visible rows strictly older than that sequence. A deleted but otherwise visible anchor remains usable to avoid breaking pagination when a card is removed; missing, cross-game or inaccessible anchors return 404. Filter out deleted rows from results. A UUID is an opaque position, not an authorization credential.

This is a **breaking response and pagination change**: old clients expecting numeric sequences or cursors cannot safely coexist with the new history API. Deploy the frontend and backend together and update API consumers, tests, OpenAPI and prototypes/mocks that use these contracts. The backend may continue accepting old create bodies, but must not keep an old sequence-bearing list endpoint: it leaks private activity.

The client merges ordered pages by ID and page order rather than numeric sorting. Reset older loaded pages when a newest-page refresh could invalidate the loaded window; then the user can load older entries again. This avoids assuming consecutive visible records or using hidden sequence gaps as a continuity test. An anchor invalidated by access changes gets an actionable retry and a fresh newest page. Account-scoped query keys already exist; clear or invalidate cached history on logout, account switch or loss of membership, and do not render stale data after access is denied.

## Live updates

Extend `events/streams.ts` with targeted publication to active subscriptions matching both game and author account. Public creation and deletion keep the current game-wide hint; private creation and deletion send a hint only to the author, including their other sessions. Determine the event audience from the committed row, including on deletion. Keep payloads as generic `throws` hints and publish after commit. Existing stream setup, session closure and membership revocation checks remain in force. The creating client also invalidates its own history after mutation, and reconnect refetches authoritative visible history. No global event, count or sequence value may reveal another account's private activity.

## UI and data flow

The [UI specification](ui.md) places **Private roll** in both setup dialogs. Add draft state in `GameTable.vue`, initialize new drafts to false and rerolls from the visible source record, and pass it through the injected API service to create. The server returns the authoritative visibility and filtered history. Render the `Private` label only on returned private cards, and preserve the existing result/highlight, pending, cancellation and uncertain-submission flows. Apply actionable API error toasts and retain drafts for known failures. No prototype code is available to migrate.

All entry points need the same contract: character attribute and weapon rolls; NPC attribute and attack rolls; free and opposed rolls; and rerolls of each supported type. Existing resolution constraints still decide whether a particular reroll is permitted. `types.ts`, `api.ts`, `hooks.ts`, `history.ts`, shared mocks and browser fixtures must match the new shape and ID cursor.

## Verification targets

- Integration-test migration defaults and creation for both roles and roll types. Verify public, own-private and other-private list behavior before pagination, including multiple full pages, deletions, invalid anchors, revoked membership and account changes.
- Attempt another account's private ID as standard and NPC reroll source, delete target and cursor, including GM and already-deleted cases; assert indistinguishable 404 and no mutation or disclosure. Check public permissions remain intact.
- Verify targeted events reach all and only the author's active streams for private creation/deletion, while public events reach game members; test revocation and reconnect behavior.
- Exercise checkbox state, public/private history, rerolls, failures, keyboard operation, account isolation and refresh in browser tests. Update history window tests for ID ordering and reset; ensure private activity cannot be inferred from numeric sequence gaps or event hints.
- Validate and bundle the proposed OpenAPI, then update and validate the production schema during implementation. Run the affected frontend, backend and API suites against a disposable database where required.
