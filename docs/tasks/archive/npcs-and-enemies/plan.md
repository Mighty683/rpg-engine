# NPCs and enemies — implementation plan

**Created:** 2026-11-12

Acceptance and required checks are defined in the [handover](handover.md). The prototype and implementation decisions are approved. Deliver the module below as one integrated increment. Its tasks are ordered by dependencies, not separate releases: NPC rolls are part of the NPC experience and ship with it.

Each wave is implemented by a separate sub-agent, one per wave. Planning does not dispatch agents. The wave owner accommodates existing edits and never reverts others' work.

## Module 1 / Wave 1 — NPCs at the game table

The wave 1 sub-agent owns the shared contracts and integration across all tasks. Complete backend, frontend and integration work together before treating the module as delivered.

| Task | Edit boundary | Work | Depends on | Handover checks |
| --- | --- | --- | --- | --- |
| NPC backend | NPC schema, migration, contracts, routes and NPC API integration tests | Implement game-scoped storage, validation, visibility projections, create, update, removal and safe invalidation. | Existing game access and transaction infrastructure | API-01, API-02, API-03, NPC portions of API-06 |
| Roll backend | Throw service, history, event authorization and roll API integration tests | Implement authoritative NPC attribute and attack rolls, public snapshots and rerolls. Preserve existing shared history and permissions. | NPC contract and persistence; existing event delivery | API-04, API-05, throw portions of API-06 |
| Frontend | Production NPC API client, controller, cards, editor, roll controls and throw history | Adapt approved prototype components to production contracts. Implement management, visibility, optimistic updates, refetch, stale-response handling and public roll history, including accessible and responsive states. | NPC and roll contracts; approved prototype | Supports E2E-01 through E2E-05 and visual review |
| Integration and verification | NPC and roll browser features, steps and page objects; integration across the preceding boundaries | Wire the complete table experience, exercise live changes and revocation, and run browser and API checks. Review the approved design across relevant screen sizes and states. Run relevant prototype checks and record evidence in the handover. | Backend and frontend tasks | E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, API-01 through API-06; visual review |

The wave owner records commands, outcomes, visual review and unresolved failures in the handover. Unit coverage is decided alongside implementation. Once acceptance is met, update the summary and archive the task as directed by the handover skill.
