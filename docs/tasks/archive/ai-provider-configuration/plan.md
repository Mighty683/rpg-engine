# GM table Agent — implementation plan

**Created** 2026-11-17. Build against the [technical design](tech.md) and [task OpenAPI](openapi.yaml). The [handover](handover.md) owns the acceptance criteria, scenarios and verification evidence.

## Ownership and sequence

Implement the five waves in order, with a **different subagent for each wave**. Each worker starts from the preceding integrated revision, owns the listed production paths and tests for its wave, and accommodates existing changes. The implementation lead owns cross-wave integration and shared HTTP contract decisions. Wave 1 lands the common types and canonical contract on the lead’s behalf. Later workers coordinate contract changes with the lead before modifying either side. Keep the feature disabled by default throughout implementation.

| Wave and owner | Dependency | Checks the owner implements and runs |
| --- | --- | --- |
| 1 · Persistence and HTTP | Existing auth, migrations and task contract | GM-API-01, GM-API-10. Migration, data preservation and restricted-role verification. |
| 2 · Turn runtime and reads | Wave 1 routes, transcript store and grants | GM-API-02, GM-API-03, GM-API-06, GM-API-07, GM-API-08, GM-API-09, GM-API-11. |
| 3 · Production chat | Wave 2 can answer questions, report availability and commit history | GM-E2E-01, GM-E2E-02, GM-E2E-03, GM-E2E-07, GM-E2E-10. Whole-screen prototype comparison at both viewport widths. |
| 4 · Rolls and rerolls | Wave 2 tool dispatch and Wave 3 production chat | GM-API-04, GM-E2E-04, GM-E2E-05, GM-E2E-06. |
| 5 · Profile edits and final integration | Wave 4 review interaction and completed read/roll flows | GM-API-05, GM-E2E-08, GM-E2E-09. Rerun the combined suites and coordinate final evidence with the lead. |

## Wave 1 — Store and retrieve GM history

- Own the journaled migration, Drizzle schema, runtime grant script, Agent transcript store, Agent routes and Ajv parity registration. Integrate the proposed operations into the backend OpenAPI, lint and bundle it. Resolve one contract detail with the lead before UI work: the weapon preview needs a GM-visible target label outside the ordinary create-throw payload, so Agile can appear in review without entering a public throw note.
- Migrate an already-seeded disposable database as schema owner. Verify the party, throws and NPCs survive, existing games start with empty transcripts, and the restricted app role can insert a turn, use its sequence, page history and update an NPC with attacks. Confirm effective transcript privileges. Reuse the existing demo seed. Record commands, roles and results in the handover. [Preparation instructions](tech.md#database-and-api-contract)
- Wire the GM-only status and turn routes in app composition with the disabled-provider behavior. Enforce session, GM ownership, write Origin and CSRF before provider access. Implement exclusive, game-and-GM-scoped cursor reads, chronological page responses and the immutable completed-turn insert under the game lock. Exercise paging with fixture turns and concurrent appends.

## Wave 2 — Complete a read-only turn end to end

- Own server configuration, Mistral adapter, turn orchestration, admission, tool registry and scoped domain read capabilities. Inject a scripted adapter into the real test application, including restart and cancellation controls. Keep live credentials outside automated tests.
- Build basic context from the current GM table, expand records through the three read tools and source follow-up context from persisted turns. Project hidden NPC details for the owning GM, public and own private throws, and actually learned skill descriptions, costs and effects. Support clarification for missing or ambiguous information.
- Enforce one active turn per game, ten across the backend and six admissions per account per minute. Apply the 10-second deadline and cumulative ceilings of 20 model calls, 10 tool calls, 20,000 input and 2,000 output tokens. Recheck access across provider awaits. Commit only completed turns, release slots on every exit and reconcile uncertain responses through persisted history. Run the assigned API cases with a disposable database, including provider-payload assertions and restart recovery.

## Wave 3 — Deliver the GM chat on the production table

- This worker owns the production mount and its visual verification. Promote the prototype AgentPanel view, reuse GameTable’s launcher and nonmodal slideover, and mount the controller from the GM table branch of GameView. Wire the client through the frontend service registry and main composition root. Keep the Histoire story on the reusable view with injected mocks.
- Connect draft, busy, disabled and retry states to the real endpoints. Handle account/game switches and stale responses. Open the newest page at the bottom. Prepend older pages on top scroll, preserve the visible message offset, deduplicate by ID and reconcile polls and reconnects without pulling a GM away from older messages.
- Implement the assigned Cucumber journeys using page objects, backend fixtures and the scripted adapter. As soon as the production route renders, capture the **complete table** beside the Histoire reference at 793 px and 360 px in minimized, open, unavailable and Throw history states. Record the revision and discrepancies in the handover. Verify skill advice through the mounted chat and the absence of Agent controls for players.

## Wave 4 — Prepare and confirm rolls

- Own the prepare-throw tool, roll projection, chat action review and integration with GameTable’s existing roll dialogs and submit path. Resolve actor, target, equipment, current dice, sheet revision and eligible source throw on the server. Preserve hidden-target privacy when composing a public throw record.
- Drive the hammer attack, tumbling check, shorthand free roll and private reroll through the production UI. Exercise ambiguous and incomplete weapons, explicit attribute overrides and unsupported dice pools. Keep preparation separate from committing a throw. Verify the ordinary API creates one result on confirmation and refreshes history after an uncertain response.

## Wave 5 — Apply reviewed edits and verify the integrated revision

- Own character and NPC preparation tools and their editor integrations. Build one reviewable proposal from current values and the captured revision. Keep pending previews outside autosave, preserve unrelated fields and drafts, and use the existing save paths. Cover cancel, stale revision, refreshed review and confirmation. Follow the handover’s proposed review interaction and editable fields, recording any product decision that changes acceptance there before adjusting tests.
- Run the assigned scenarios, then rerun the API and browser suites on the integrated revision with a dedicated TEST_DATABASE_URL. Recheck Wave 3 screenshots against the delivered revision and repeat database checks if integration changed persistence or grants. Record outcomes, failures, revision and evidence paths in the handover. [Cross-module test guidance](../../../../packages/tests/AGENTS.md)

~~~sh
pnpm --filter @rpg-engine/tests test:api --run
pnpm --filter @rpg-engine/tests test --run
~~~

The implementation lead owns the separate deployment check using synthetic game data and the pinned mistral-small-2603 model. Exercise the four launch prompts once the read and proposal tools are integrated. Record tool selection, argument accuracy, clarification and latency in the handover. Deployment enablement and the real-game provider data policy remain product decisions. Archive the task only after implementation and handover verification.
