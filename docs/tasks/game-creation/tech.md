# Game creation — technical design

**Created:** 2026-11-04  
**Status:** Proposed; not implemented.  
**Related:** [UX journey](ux.md) · [UI solution](ui.md) · [Recap](recap.md)

## Scope and current foundation

Provide the single-GM application with a persisted game list and game creation. A game has a required name and RPG system; its system cannot change after creation. It may represent a campaign or a single session without a type choice. Player workflows, opening or editing games, system setup, identity, and AI actions are outside this task. No separate story exists; sequencing is in the [implementation plan](plan.md).

The [frontend](../../../packages/frontend/src/App.vue) is a Vue/Nuxt UI placeholder; [main.ts](../../../packages/frontend/src/main.ts) mounts it without an existing game flow. The [backend package](../../../packages/backend/package.json) declares Express, Arrow Express, Drizzle and PostgreSQL dependencies, but the [README](../../../README.md) confirms there is no server, schema or migration. No application tests or configured test runner were found. The [character setup design](../character-setup/tech.md) describes proposed rules configurations and campaign references, not delivered contracts; it must not be treated as an existing implementation.

## Responsibilities and boundaries

| Responsibility | Proposed location and contract |
| --- | --- |
| Game list and creation UI | `packages/frontend/src/modules/games`: retrieve games and available systems, manage the in-memory form and submission states, and present the agreed [UI](ui.md). Do not persist drafts in browser storage. |
| Game domain | `packages/backend/src/modules/games`: validate and create games, list saved games, and own game identity and the immutable system association. Keep HTTP handling separate from domain/persistence responsibilities. |
| RPG system catalog | `packages/backend/src/modules/rpg-systems` may provide a hardcoded initial catalog with stable system IDs, display names and creation availability. System setup and management remain a separate task. |
| Infrastructure | Backend application/server, database connection and migrations expose the domain over HTTP and PostgreSQL. Follow the existing dependency choices and [code conventions](../../spec/code-conventions.md); place genuinely shared code in `src/shared` only where needed. |

Single GM is a deployment assumption, not authentication or authorization. Do not manufacture an owner ID or claim access control. Until identity and authorization are designed, restrict deployment to a trusted environment; a public or multi-user deployment is not secured by this assumption.

## Data and invariants

Proposed minimal game record: opaque stable ID, required name, required RPG system ID and creation timestamp. No campaign/session discriminator, player record, character reference, system settings or draft record is required. The timestamp supports stable list ordering with ID as a tie-breaker; duplicate names are allowed and must not be used as identity.

- Trim surrounding name whitespace; reject empty or whitespace-only names and names longer than 20 characters on the server. Enforce the same limit in the database and communicate it in the form. Return field-level errors without discarding other input.
- Store the selected hardcoded system's stable ID; validate it on the server. Keep existing IDs in the catalog so saved games can be displayed. No separate system table or foreign key is needed for this MVP.
- Save the game after validation and return success only after the database confirms the insert. No operation in this scope changes its system.
- Drafts are client memory only: validation failures, known failures and in-app list checks preserve them, while reload or application restart loses them. A created game's durable record survives application and database process restarts when the database uses persistent storage.

The separate character proposal pins a rules configuration, which is more specific than a system identity. Whether a future game also pins a rules release/configuration is unresolved; do not silently equate the two or impose that proposal on this feature.

## Interaction contracts and failure handling

Use a small JSON HTTP boundary:

1. **`GET /api/games`:** return `{ games: [{ id, name, system: { id, name }, createdAt }] }` in deterministic order. An empty successful list differs from a failed request. Resolve labels through the system boundary; a catalog failure is an error, not an empty list.
2. **`GET /api/rpg-systems`:** return `{ systems: [{ id, name }] }` for systems currently available for creation. Empty and unavailable are distinct.
3. **`POST /api/games`:** accept `{ name, systemId }` and return `201` with `{ game }` after saving. Reject invalid system IDs and names with field errors.

Errors use `{ error: { code, message, fields? } }`. Use `400` for malformed requests and `422` for invalid input. A transport error may leave the save outcome unknown.

Do not automatically retry creation. Disable repeat submission while it is pending; if the outcome is unknown, let the GM check the game list before deciding whether to try again. Duplicate names are allowed, so the list cannot always resolve ambiguity. Durable idempotency and duplicate prevention across retries are deferred.

Differentiate validation/known rejection from a transport interruption or server failure where commit status is unknown. Map the latter to the UI's unknown-outcome state; never assert that a game was not created solely because the response failed. Sanitize errors and avoid exposing database details. Retrying a list failure must not erase a confirmed creation message.

## Decisions and tradeoffs

- **Database-backed games, transient setup:** gives durable saved games without draft storage or draft lifecycle complexity; unfinished work is lost on reload/restart.
- **Hardcoded system catalog:** avoids building system management or synchronizing a second catalog for the MVP. Keep IDs stable while games refer to them.
- **No durable retry protocol:** keeps creation simple; an uncertain response can require manual list inspection and a retry could create a duplicate.
- **No identity or player model now:** keeps the single-GM flow small, but requires a trusted deployment and later authorization design before multi-user exposure.

## Verification requirements

Follow [testing conventions](../../spec/testing.md): Vitest unit tests cover input branches; browser tests cover complete journeys without duplicating unit cases. Test infrastructure is not yet configured.

- Unit/API: valid creation, empty or over-limit names, invalid system ID, and empty versus failed list.
- Database/browser: create and list a game, verify it survives restart, and verify an unfinished form is lost on reload. Check validation and a failed or uncertain save without falsely reporting success.

## Blockers and decisions still needed

- Choose an initial RPG system and stable ID for the hardcoded catalog. Listing a system does not claim that its game rules are implemented. System management remains a separate task.
- Choose straightforward ID and local runtime configuration during implementation. The backend and database schema do not exist yet.
