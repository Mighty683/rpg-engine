# Class management — implementation plan

**Created:** 2026-11-15 · [Handover](handover.md) · [Technical design](tech.md) · [OpenAPI](openapi.yaml)

One sub-agent owns each wave and its integration. Run the waves in order. Each owner adds only the operations and schemas for their wave to canonical OpenAPI, including Ajv parity. Verify the increment before handing it off and preserve previous edits.

## Wave 1 — Library and game copies

**Owner: Wave 1 sub-agent.**

| Edit boundary                                                 | Work                                                                                                                                                                                                                                                                           | Depends on                                                                | Handover checks                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------- |
| Catalog storage, application wiring, and library and copy API | Add account templates and game definitions. Implement library reads and edits, game catalog reads, copy, and save to library with revisions and create receipts.                                                                                                               | Existing sessions, game access, database transactions, and draft contract | API-01 for these routes, API-02 |
| Catalog UI and navigation                                     | Link the library from the games overview. Wire the shared editor and copy and save dialogs into the library and game views. Show the game definition for inspection. Check the production screens as soon as they render, including narrow, loading, empty, and failed states. | Catalog client and approved UX                                            | E2E-01                          |

## Wave 2 — Character progression and effects

**Owner: Wave 2 sub-agent.**

| Edit boundary                                    | Work                                                                                                                                                                                                                                                                         | Depends on                                              | Handover checks        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------- |
| Characters, Fabula rules, and roll reader        | Add progression storage and initialize EXP while preserving manual entries. Extend character create, read, and PATCH and the party read. Calculate and persist EXP deltas under the character revision. Use one effects calculation for the sheet, party, and default rolls. | Wave 1 game definitions and stable skill IDs            | API-03, API-04, API-05 |
| Production character view, table, and save queue | Mount the approved class, skill, and EXP controls in the existing sheet route and table drawer. Wire role access, ordered saves, party updates, and reconciliation. Check the GM and player views early on desktop and narrow screens, including pending and failed saves.   | Character and party contracts plus Wave 1 catalog reads | E2E-02, E2E-04         |

## Wave 3 — Live game class edits and removal

**Owner: Wave 3 sub-agent.**

| Edit boundary                                                     | Work                                                                                                                                                                                                                            | Depends on                                                            | Handover checks                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| Game class PATCH and DELETE, transaction coordination, and events | Add game definition edits and deletion. Wire character-owned operations for confirmed rank removal and affected revisions. Recheck impact under the game lock and publish invalidations after commit.                           | Waves 1 and 2, including saved allocations and revisioned projections | API-01 for PATCH and DELETE, API-06, API-07 |
| Game class editor and end-to-end integration                      | Enable game editing and removal in the shared editor. Wire confirmation, cancellation, refreshed impact, and sheet and catalog invalidation. Check the real dialog on desktop and narrow screens. Run the complete task checks. | Game edit API and prior production views                              | E2E-03, rerun all earlier checks            |

Each owner implements and runs the checks in their row in `packages/tests`. Run API integration and browser scenarios against disposable PostgreSQL. Run `pnpm check` per wave and `pnpm verify` on the integrated result. Record results and screen comparisons in the handover.
