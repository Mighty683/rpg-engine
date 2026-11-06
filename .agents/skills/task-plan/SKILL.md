---
name: task-plan
description: Plan implementation work with ownership, dependency waves, and verification.
---

# Task Plan

Check the task phases against current dependencies. Scale sequencing and verification to the work. For parallel work, assign exclusive edit boundaries and one owner for shared contracts and integration. Planning does not authorize dispatching agents. Each wave should deliver working part of application and leave it in state for further development.
Tests are created at end of wave when whole part is integrated.

Plan to reuse the approved prototype components and wire them to production. Check that the result matches the prototype across relevant screen sizes and states.

## Example: `docs/tasks/<task>/plan.md`

```markdown
# Game creation — implementation plan

**Created:** 2026-11-04

## Wave 1
Goal: <goal of wave>
Acceptance criteria: Table of tests to be created at end of wave


### Task A
Area: Backend
Bounduary: modules connected to task, not list of files
Task: task description
Needs: -

### Task B
Area: Backend
Bounduary: modules connected to task, not list of files
Task: task description
Needs: -

## Wave 2

### Task A
Area: Frontend
Bounduary: modules connected to task, not list of files
Task: task description 
Needs: Wave-1

### Task B
Area: Frontend
Bounduary: modules connected to task, not list of files
Task: task description 
Needs: Wave-1-B
```
