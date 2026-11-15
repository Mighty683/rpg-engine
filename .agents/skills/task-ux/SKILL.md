---
name: task-ux
description: Research and document a task’s user flow, screen design, and prototype decisions.
---

# Task UX

Follow the [UX guidelines](../../../docs/spec/ux.md). Base the flow on the task, product context, relevant research, and current implementation. Label simulated research and untested assumptions. Include unresolved questions only when they affect the flow.

Record UX, UI, and prototype decisions together in `docs/tasks/<task>/ux.md`. Include the affected screens, interactions, component references, and relevant verification when the task has a prototype.

## Document structure

Use these sections in each task's `ux.md`. Keep diagrams in fenced `mermaid` blocks in the same Markdown file.

- **Domain language** defines terms that matter to the task and uses them consistently in the action list and diagrams.
- **Actions by role** uses a Markdown table with columns `Role | Action | Screen or control | Scope`. Write actions as verb phrases. Include the task's affected roles and mark deferred workflows explicitly.
- **Screen map** uses a Mermaid flowchart. Use screens and dialogs as nodes, and label transitions with the action or control that takes the user there. Include return paths when they clarify where the user lands.
- **Data flows** uses Mermaid diagrams for the task's main operations. Show what each action reads, the rules that govern it, what it writes or derives, and which views show the result. Use a flowchart for data dependencies and a sequence diagram when order matters. Include confirmation, validation, or recovery branches when they change the outcome.

Use the [class-management UX document](../../../docs/tasks/class-management/ux.md) as the worked example.
