---
name: task-tech
description: Research affected modules and document technical decisions for a task.
---

# Task Tech

Inspect relevant implementation, tests, and architecture guidance. Include contracts, data flow, compatibility constraints, and blockers where they affect the design. Prefer module references; specify exact APIs only to settle a boundary. Keep sequencing in the plan.

UI prototype code should be ready to be reused components from there will be migrated to production app. You can adjust data types in prototype code to match decided architecture.

For UI work, document how the approved view connects to production data, permissions, and persistence. Walk affected entry points and record which flows change. Carry forward agreed decisions and ask only about unresolved choices that materially affect delivery.

For HTTP API changes, prepare a machine-readable OpenAPI 3.1 `openapi.yaml` beside `tech.md` and link it for user review. Cover affected operations and schemas, including authorization and errors. If the HTTP API is unchanged, state that no schema update is needed.

## Example: `docs/tasks/<task>/tech.md`

```markdown
# Game creation — technical design

**Created:** 2026-11-04

## Current Situation

Description of current state of product

## Decision record

What important decision were made by the way of analysis and implementation

## Implementation spec

Description of changes

### Database schema

### API schema

### UI Screens updates
```
