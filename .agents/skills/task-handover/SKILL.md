---
name: task-handover
description: Define task acceptance criteria and required tests before implementation planning, record verification evidence, and archive implemented tasks.
---

# Task Handover

Write `docs/tasks/<task>/handover.md` before the implementation plan. Use the story, UX, UI, and technical design as sources. The handover must stand on its own. Group tests by test level and product behavior.

Limit the handover's test scope to browser E2E and API integration in `packages/tests`. Describe complete browser journeys as Gherkin scenarios and API integration cases with expected outcomes and persisted effects. Follow the package guidance and give each test a stable ID. Decide unit coverage alongside the code during implementation.

For UI work, turn consequential design decisions into checks on the production route. Compare the complete screen with the approved prototype at relevant sizes and states. Record the comparison and required check results for the delivered revision before archiving.

Use the handover for final acceptance. Record checks as pending until they run, then add evidence, failures, and open items. After implementation, set the task summary status to Implemented and move the complete task directory to `docs/tasks/archive/<task>/`; update links to and from the moved documents and preserve outstanding verification and open items.

## Example

```markdown
# Game creation — handover

**Updated:** 2026-11-06
**Sources:** [Story](story.md) · [UI](ui.md) · [Tech](tech.md)

## Goals

- A signed-in GM can create and reopen a game.

## E2E tests

Scenario: E2E-01 — Create and reopen a game
  Given a signed-in GM
  When the GM creates a game and reloads the game list
  Then the new game is available to open

## API tests

- API-01 — A signed-out create request returns 401 and creates no game.

## Verification evidence

Pending implementation and test execution.
```
