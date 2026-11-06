# Game Table — implementation plan

**Created:** 2026-11-06

Use the [technical design](tech.md) for contracts and the [UI design](ui.md) for production behavior. The [handover](handover.md) defines the required checks. Owners below are implementation roles. The integration owner maintains shared HTTP and event contracts, app wiring, the migration journal, and final verification.

## Wave 1 — Active party and permission test split

The Fabula Ultima workspace shows live active characters and opens the existing sheets in the drawer. Settings and character management remain reachable.

| Owner | Edit boundary | Work | Depends on | Handover checks |
| --- | --- | --- | --- | --- |
| Character backend | Character workspace and Fabula sheet projection | Add the batched active-party read with stable IDs, revision, derived values, equipment, and roll capability. Reuse existing active and sheet rules. | Active-party response contract | — |
| Workspace frontend | Game workspace, party presentation, and sheet drawer | Reuse the prototype cards and drawer presentation with the production roster, sheet controller, Settings and management routes. Refetch the party on existing roster and sheet hints. Wire roll actions in Wave 3. | Active-party response contract | E2E-01 |
| API test owner | Existing permission suites and fixtures | Split the suite by area, retain ordinary permission and revocation coverage, and drop the lock-coordinated removal and reassignment cases. Run the new suites with isolated schemas. | Existing API and test harness | API-01 |
| Browser test owner | Game Table feature, steps and page objects | Implement and run the party, sheet drawer and Settings journey. | Integrated workspace | E2E-01 |

## Wave 2 — Shared throw API

Authorized clients can create and read throws, use a historical recipe for rerolls, and remove entries. The backend persists results and publishes committed changes.

| Owner | Edit boundary | Work | Depends on | Handover checks |
| --- | --- | --- | --- | --- |
| Fabula backend | Roll resolution | Implement server dice generation and pure outcome calculation. Decide unit coverage alongside the code using the repository testing conventions. | Roll setup and outcome contract | — |
| Throw backend | Throw service and route handlers | Persist immutable snapshots and removal markers. Resolve current access and stable attribution under the game lock. Add ordered history reads, retry handling, and source validation for rerolls. | Wave 1 party rules, roll resolver, persistence contract | — |
| Integration | Migration, route registration and game events | Wire the migration and guarded routes. Publish history invalidation after commit through the existing game stream. | Throw service and shared contracts | — |
| API test owner | Game Table API suite | Implement and run the required API cases against the mounted routes with PostgreSQL. Reuse the fixtures from Wave 1. | Integrated throw API and fixtures | API-02, API-03, API-04, API-05 |

## Wave 3 — Live rolling and history

GM and player sessions can roll, reroll, and follow shared history through the Game Table.

| Owner | Edit boundary | Work | Depends on | Handover checks |
| --- | --- | --- | --- | --- |
| Workspace frontend | Roll dialogs, history presentation, and game workspace queries | Reuse prototype controls and wire attribute, weapon, and free roll entry points to the API. Use current session permissions and all active characters in the GM picker. Restore reroll drafts by ID. Connect pagination, submission retries, removal, and live refresh. Apply the reviewed desktop and narrow layouts, scroll behavior, highlight, and recovery states. | Waves 1 and 2 | — |
| Browser test owner | Game Table browser journeys | Implement and run the rolling, shared history, active character switching, weapon setup, older history, and opposed reroll journeys. | Integrated live rolling | E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, E2E-07, E2E-08 |
| Integration | Full-stack verification and evidence | Run repository checks and both acceptance suites. Record the API integration and browser E2E results in the handover. Review the production UI against the approved design. | Integrated Game Table and all planned tests | All handover checks |

During the UI review, check desktop panel heights and independent history scrolling, the narrow layout, keyboard operation, and the brief highlight with reduced motion enabled and disabled. Check pool removal and the two-die limit tooltip, incomplete weapon guidance, pending and failed submissions, and empty history. Reconnect after missing a roll and a removal and confirm history matches the server.
