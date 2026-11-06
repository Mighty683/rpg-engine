---
name: task-handover
description: Create or update a task handover with implementation acceptance criteria and verification evidence.
---

# Task Handover

Write `docs/tasks/<task>/handover.md` This file will be used as final check if application is working. You plan tests for E2E and API integration in `packages/tests`. You can separate tests by each wave of implementation in task plan.

## Example: `docs/tasks/<task>/handover.md`

```markdown
# Game creation — handover

**Updated:** 2026-11-06
**Sources:** [Story](story.md) · [UI](ui.md) · [Tech](tech.md) · [Plan](plan.md)

Reuse the approved game form and list components; replace their mock data with production hooks.

## Goals

<list of most important goals which should be fulfilled>

## E2E tests

### Wave 1

<gherkin scenarios to implement>

### Wave 2

## API tests

### Wave 1

<list of APi scenarios to test in integration with test database>

### Wave 2

...

## Open items

None identified. Complete the checks above before marking the task Implemented.
```
