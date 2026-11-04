---
name: task-plan
description: Plan implementation work with ownership, dependency waves, and verification.
---

# Task Plan

- Read existing task phases and inspect affected dependencies. Follow the project's task conventions.
- Structure the plan in clear dependency-ordered waves. Give each task concrete inputs, outputs, completion checks and an assigned agent or owner.
- Identify tasks that can run in parallel and those that must wait. Give parallel agents exclusive edit boundaries; assign one owner for shared contracts, shared files and integration.
- Scale agents and waves to the work. Use serial tasks when parallelism adds needless overhead.
- Include relevant formatting, analysis, tests and runtime checks.
- Writing a plan does not authorize dispatching agents. Workers must accommodate others' edits and never revert them.
- Write the result to `docs/tasks/<task>/plan.md`, using the existing task directory or a descriptive kebab-case name. Preserve existing content and creation metadata, link relevant phase documents, and ask before overwriting unrelated work.
