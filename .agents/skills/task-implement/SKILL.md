---
name: task-implement
description: Implement one planned wave of a task with focused, verified edits.
---

# Task Implement

- Read the wave's steps in the [task plan](../task-plan/SKILL.md) and the affected code and tests.
- Follow the agreed flow and decisions in the [ux spec](../../../docs/spec/ux.md), [ui spec](../../../docs/spec/ui.md), and [code conventions](../../../docs/spec/code-conventions.md); game rules live in the [fabula-ultima spec](../../../docs/spec/fabula-ultima/README.md).
- Respect the wave's assigned edit boundaries; keep shared contracts stable and never revert or rewrite other agents' edits.
- Make the smallest correct changes following the project's coding conventions.
- For UI work, wire the approved shared view to production services and check it on the real route early. Record deliberate departures in the task docs.
- For HTTP API changes, apply the approved task schema to the canonical OpenAPI document in `packages/backend/openapi/` alongside the code and run the schema check.
- Verify with the relevant formatting, tests, and runtime checks per the [testing spec](../../../docs/spec/testing.md).
- When dev startup is part of delivery, smoke-test the actual dev entry point in an isolated instance. Record verification for the delivered revision in the handover.
- Report what changed, what remains, and any blockers.
