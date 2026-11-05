# Character setup — implementation plan

**Created** 2026-11-06

**Inputs** [Story](story.md) · [UI prototype](ui.md) · [Technical design](tech.md)

The MVP delivers a persistent manual sheet for the GM. The integration owner maintains the HTTP contract and connects the backend and frontend at the end of each wave. Add verification once each wave works through the application.

## Wave 1 — Fabula Ultima games and player roster

| Owner | Edit boundary | Work | Depends on |
| --- | --- | --- | --- |
| Backend | Games, system catalog, player roster and migrations | Replace the D&D placeholder with Fabula Ultima. Filter unsupported game rows before presentation and reject retired system IDs on creation. Add scoped game detail and player list, detail and retry-safe creation. Apply `002_players.sql`. | Existing game creation. |
| Frontend | Game and player routes, hooks and views | Open saved Fabula games, add named players and navigate to their pages. Put endpoint calls in module `api.ts` files and expose Vue hooks for all game, system and player requests. Configure TanStack Vue Query and move existing game calls through those boundaries. | Agreed game and player contracts. |
| Integration | App wiring and test bootstrap | Use the same migration runner for the CLI and isolated browser stack. Replace D&D test selections with Fabula Ultima. | Backend and frontend increments. |

| Verification | Acceptance |
| --- | --- |
| API and PostgreSQL | Only Fabula Ultima is offered and accepted. Old placeholder rows are excluded from reads. Duplicate player names work with distinct IDs. Replaying the same create ID returns one player. A player read through another game returns 404. |
| Browser | Create and open a Fabula game, add a player and reload the roster. Exercise empty, loading and failed reads and a safe retry after a lost create response. |

## Wave 2 — Named character sheets and active selection

| Owner | Edit boundary | Work | Depends on |
| --- | --- | --- | --- |
| Backend | Character persistence and HTTP, Fabula calculations and player activation | Apply `003_characters.sql`. Add relational character, class, skill and equipment storage. Implement scoped list, create, read and conditional save, plus select and clear active character. Calculate partial previews and return unavailable results for ambiguous equipment. | Wave 1 player identity and migration runner. |
| Frontend | Character API and hooks, shared optimistic save, player character list and sheet | Add named creation and rename, sheet routes, responsive editing, resource and defense overrides, browser-local lock, and select and clear active actions. Put calls in `api.ts` and wrap them in feature hooks. Use the shared `useOptimisticSave` for optimistic writes, with refresh and rollback behavior. | Wave 1 routing and Vue Query setup. |
| Integration | App wiring and verification | Connect real endpoints and verify both fresh install and migration from Wave 1. | Backend and frontend increments. |

| Verification | Acceptance |
| --- | --- |
| Database and API | Reject blank names, invalid dice, and a third class. Accept duplicate character names and multiple equipped armor or shields. Replaying creation after rename preserves the renamed sheet. Cross-player activation fails. Select and clear the active character. Race conditional writes and verify the stale write cannot overwrite saved inputs. |
| Rules | Verify base resource maxima, fixed armor followed by shield, negative initiative, and unavailable calculations for ambiguous equipment. Verify applying and clearing each override. Changing a maximum leaves current values alone. Current values may exceed their maximum. |
| Browser components | Verify optimistic updates, slow acknowledgements, newer input during a save, rollback and refresh after failure, and a response after navigation. Verify calculation status while saving, and lock behavior across reloads in the same browser. |
| Full stack | Create a Fabula game and a player, create two named characters, edit one, and select it as active. Reload, open the same sheet by URL, verify saved inputs and the active name, then clear the selection. |

Run the backend and frontend builds, repository checks, API and browser component tests, and the Cucumber/Vitest journey against a disposable PostgreSQL database. [Testing conventions](../../spec/testing.md) · [End-to-end package guidance](../../../packages/tests/AGENTS.md)

## Follow-on milestone — Rules validation

Plan sourced skill ranks, choices and effects, spell data, starting equipment, and versioned catalogs. Resolve the review and completion interaction before adding a rules-validated profile. [Fabula Ultima character specification](fabula-ultima-character-spec.md)
