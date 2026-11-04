# Game creation — recap

**Created:** 2026-11-04  
**Completed:** 2026-11-04  
**Status:** Finished.

## Intent and scope

The person running the application acts as the single game master and wants to create a game. A game can be a campaign or a single session without choosing at creation. A name of at most 20 characters and an RPG system are required; the system cannot be changed afterwards. Created games are saved in the database and survive restarts; unfinished setup is lost on restart or reload. A simple game list is the first screen; no further game actions are required for now. Player workflows and identity remain outside this task.

## Delivered

- Replaced the placeholder with a saved-game list and creation form using Nuxt UI. Added validation, loading/empty/error states, fixed-system warning, discard confirmation, pending submission, and success toast after confirmed creation.
- Added an Express backend with module-owned Arrow Express controllers for game listing, creation, and the RPG-system catalog. Names are trimmed and validated; duplicate names are allowed; no operation changes a game's system.
- Added UUID game identity, PostgreSQL persistence and migration, deterministic list ordering, and the initial Dungeons & Dragons 5e catalog entry (`dnd-5e`). Listing the system does not implement its rules.
- Preserved drafts in memory during recoverable errors and an unknown-outcome list check. Creation is never automatically retried; an uncertain response can require manual inspection and a retry may create a duplicate.
- Added frontend component browser tests with mocked API responses and a separate end-to-end package. Gherkin features drive Cucumber.js step definitions through Vitest; domain-based steps use page objects and stable test IDs.
- Documented startup, migrations, test commands, and deployment limits in the [README](../../../README.md). The [plan](plan.md), [technical design](tech.md), [UI solution](ui.md), and [UX journey](ux.md) now reflect delivery.

## Verification results

Latest test run on 2026-11-04:

| Suite                      | Result            | Coverage                                                                                                                                                                     |
| -------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API/unit                   | 4 passed          | Valid creation and trimming; blank/over-limit names and invalid systems; empty versus failed listing; malformed JSON; catalog endpoint; sanitized save failure.              |
| Frontend component browser | 1 passed          | A failed list request can be retried to reach the empty state, using mocked API responses without a backend.                                                                 |
| Cucumber end-to-end        | 1 scenario passed | Real frontend, backend, and isolated PostgreSQL schema: visible create button, named game and selected system, success toast, list entry, and persistence after page reload. |

Frontend build, backend and end-to-end type checks, and `pnpm check` passed during implementation. A separate manual database check confirmed that a saved game survived a PostgreSQL container restart.

The automated suites do not comprehensively cover unknown-outcome recovery, discard/focus behavior, system-loading failures, draft loss on reload, or narrow-screen layouts. Simulated personas and interviews are not usability validation with actual GMs.

## Decisions and lasting tradeoffs

- Persist completed games, keep drafts transient: saved games are durable without adding draft storage or recovery infrastructure.
- Keep a hardcoded catalog with stable IDs: avoids system-management infrastructure for the MVP; retain referenced IDs so saved games remain displayable.
- Use separate HTTP controllers and game services: module boundaries own routing while persistence stays outside bootstrap wiring.
- Defer durable retry deduplication: keeps creation small, but uncertain saves and same-name games cannot always be disambiguated through the list.
- Treat single GM as a deployment assumption: authentication and authorization are not implemented; deployment requires a trusted environment.

## Deferred scope

Game opening/editing, player participation, system setup/rules, identity/permissions, AI actions, and future character or rules-configuration associations remain separate work. There are no remaining implementation decisions blocking this task's delivered MVP.
