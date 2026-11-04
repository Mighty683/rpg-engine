# Game creation — implementation plan

**Created:** 2026-11-04  
**Status:** Proposed; not implemented. Initial system choices and infrastructure decisions remain open.  
**Inputs:** [UX journey](ux.md) · [UI solution](ui.md) · [Technical design](tech.md) · [Recap](recap.md) · [Code conventions](../../spec/code-conventions.md)

## Scope and gates

Deliver the first-screen game list and creation of a named game bound permanently to a selected RPG system, saved in PostgreSQL. Do not add player workflows, game opening, system setup, identity, or AI actions. A game is not classified as a campaign or session at creation. Unfinished setup is lost on reload or restart.

Before finalizing persistence or claiming end-to-end completion:

1. Pick an initial RPG system and stable ID for the hardcoded catalog in `modules/rpg-systems`. This does not imply its rules are implemented; system setup remains separate.
2. Choose simple ID and local database configuration during implementation. The name limit is 20 characters and proposed API/error contracts are in [tech.md](tech.md).

The integration owner owns shared contracts, configuration, application entry points and final integration. Backend and frontend agents may work in parallel after wave 1. Each agent works only in its assigned paths, accommodates others' edits and never reverts them. This plan does not dispatch agents.

## Waves and tasks

### Wave 1 — contracts and foundation

**Owner:** Integration owner. **Boundary:** shared contracts, root and package configuration, and backend application/bootstrap. No other agent edits these files.  
**Inputs:** Initial system choice, workspace manifests, [technical design](tech.md).  
**Work:** Use the simple API contracts in the technical design. Bootstrap only the needed backend server, TypeScript/build, PostgreSQL connection and migrations, and frontend-to-backend development wiring. Document local configuration, migration and startup commands. The existing root `dev` and `build` target only the frontend; do not imply they start the backend.  
**Output:** Documented contracts and commands, with frontend and backend wiring and database migrations in place.

### Wave 2 — backend and frontend in parallel

Start both tasks after wave 1 fixes the shared API contract and foundation. The frontend can use mock responses while the backend is in progress. Neither agent edits the other's paths or shared configuration. Request shared-file changes from the integration owner.

#### Task A — game persistence and service boundary

**Owner:** Backend agent. **Boundary:** `packages/backend/src/modules/games`, `packages/backend/src/modules/rpg-systems`, and game schema/migration files. The integration owner owns server bootstrap and shared database configuration.  
**Inputs:** Initial hardcoded system identities, contracts and migrated foundation.  
**Work:** Add the hardcoded RPG-system catalog, game domain and schema, deterministic list ordering and system-label resolution. Store trimmed names up to 20 characters and the selected system. Keep same-name games valid and expose no system-change operation. Implement list, selectable-system and creation HTTP operations, returning success after saving.  
**Output:** Game and system endpoints backed by the catalog and PostgreSQL.

#### Task B — first screen and creation flow

**Owner:** Frontend agent. **Boundary:** `packages/frontend/src/modules/games`. The integration owner owns `packages/frontend/src/App.vue`, shared configuration and application wiring.  
**Inputs:** Agreed API contracts and [UI solution](ui.md); use contract-compatible mock responses until task A is available.  
**Work:** Build the list and creation view using existing Nuxt UI components/tokens. Implement loading, empty and error states; required name and system selection; fixed-system warning; pending and confirmed success; known failure and unknown outcome. Keep the draft in memory through an in-app list check, never automatically resubmit, warn before discarding, and clear only on discard or confirmed success. Cover keyboard/focus behavior and narrow screens. Do not persist drafts across reloads.  
**Output:** List and creation views connected through the agreed contract.

### Wave 3 — integrate and document

**Owner:** Integration owner. **Boundary:** application entry points, shared configuration and README; coordinate changes with the responsible agent without overwriting their work.  
**Inputs:** Both wave 2 tasks, initial system catalog, acceptance outcomes.  
**Work:** Wire frontend and backend into the application, reconcile contract differences, and update the README with startup, migration and recovery instructions and deployment limits.  
**Output:** Integrated game list and creation flow with documented local setup.
