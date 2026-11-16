---
name: task-implement
description: Complete a planned task through all remaining implementation waves, integration, verification, and handover.
---

# Task Implement

Complete all remaining waves in the task plan by default. Treat wave boundaries as verification checkpoints, not stopping points. Continue through integration, required checks, and final handover without asking the user to restart each wave. Honor an explicit request to implement only a particular wave or narrower scope. If blocked, complete independent authorized work and report the concrete blocker; do not claim completion while required work remains.

- Read the task's implementation plan and the affected code and tests. Follow its dependencies and ownership through each remaining wave.
- Follow the agreed flow and decisions in the [ux spec](../../../docs/spec/ux.md), [ui spec](../../../docs/spec/ui.md), and [code conventions](../../../docs/spec/code-conventions.md); game rules live in the [fabula-ultima spec](../../../docs/spec/fabula-ultima/README.md).
- Respect the wave's assigned edit boundaries; keep shared contracts stable and never revert or rewrite other agents' edits.
- Make the smallest correct changes following the project's coding conventions.
- For UI work, wire the approved shared view to production services and check it on the real route early. Record deliberate departures in the task docs.
- For HTTP API changes, apply the approved task schema to the canonical OpenAPI document in `packages/backend/openapi/` alongside the code and run the schema check.
- For persistence changes, prepare the database schema, migrations, runtime-role grants, and necessary seed updates alongside the code. Apply migrations in an isolated database before dependent runtime checks; verify affected existing-data transitions and operations under the restricted application role. Keep local migration and seed commands current in the technical design and record results in the handover; destructive resets require explicit authorization.
- Verify with the relevant formatting, tests, and runtime checks per the [testing spec](../../../docs/spec/testing.md).
- When dev startup is part of delivery, smoke-test the actual dev entry point in an isolated instance. Record verification for the delivered revision in the handover.
- After all planned waves and required checks are complete, use [Task Handover](../task-handover/SKILL.md) to record final evidence and archive the implemented task. Completion does not itself authorize committing, pushing, or deploying.
- Report what changed, what remains, and any blockers.
