---
name: task-plan
description: Sequence implementation and assign ownership for the tests required by the task handover.
---

# Task Plan

Read the task handover before writing `docs/tasks/<task>/plan.md`. If the handover is missing, use [Task Handover](../task-handover/SKILL.md) first. The handover defines acceptance and required checks. Map each required check to an owner, dependencies, and a delivery wave for implementation and execution. Review the mapping for gaps before finishing the plan. Keep acceptance changes and verification evidence in the handover.

Sequence work around actual dependencies. Each wave should deliver an integrated increment that can be verified. Schedule checks when their dependencies are ready. For parallel work, assign exclusive edit boundaries and one owner for shared contracts and integration. Each wave MUST be implemented by a separate sub agent, one per wave, so waves stay isolated and verifiable; workers must accommodate others' edits and never revert them. Planning does not authorize dispatching agents.

Reuse approved prototype components and wire them to production. Schedule checks against the reviewed design across relevant screen sizes and states.

## Example

```markdown
# Game creation — implementation plan

**Created:** 2026-11-04

Required checks are defined in the [handover](handover.md).

## Wave 1 — Create and reopen a game

| Owner | Edit boundary | Work | Depends on | Handover checks |
| --- | --- | --- | --- | --- |
| Backend | Game creation API | Implement game creation and add API coverage. | Session contract | API-01 |
| Frontend | Game creation screen | Connect the approved form to the API. | Game creation contract | — |
| Integration | Browser journey and verification | Implement the browser scenario and run both suites. | Backend and frontend | E2E-01, API-01 |
```
