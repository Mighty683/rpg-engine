---
name: task-ui
description: Design and prototype the UI solution for an agreed task flow.
---

# Task UI

## Way of working

Write or update `docs/tasks/<task>/ui.md`. Document the affected screens and components, visual decisions, behavior, accessibility and focus, and verification targets.

Create a reviewable prototype under `packages/frontend/prototypes/<task>/` and register it in the gallery, following `packages/frontend/prototypes/README.md`. Create first simple iteration of topic, basic layout.
Follow the agreed UX and project design guidance. Reuse established components and tokens. Then together with user iterate over prototype of UI. Prototype don't need tests but should follow code conventions of project.

Build reusable UI components. Keep mocks and gallery controls separate. Reuse the approved components and styles in production. Do not rebuild them.

## Output

- Visual code which is ready for implementation in application and integration with data sources
- Documentation of UI decisions
