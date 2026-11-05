---
name: task-ui
description: Design and prototype the UI solution for an agreed task flow.
---

# Task UI

Follow the agreed UX and project design guidance. Reuse established components and tokens; justify additions. Address keyboard use and focus where relevant. Keep module internals in the technical design.

Create a reviewable prototype under `packages/frontend/prototypes/<task>/` and register it in the gallery, following `packages/frontend/prototypes/README.md`. Use representative local data and interactions to demonstrate the agreed flow and relevant loading, empty, error, and success states without requiring the backend. Reuse production components where appropriate, but keep exploratory code separate from production. Verify the prototype build and inspect the relevant states and narrow layout; report any verification that could not be performed. Do not create or run automated browser tests for prototypes.

Write or update `docs/tasks/<task>/ui.md`. Link the prototype source and describe how to run it and reach important states. Document the affected screens and components, visual decisions, behavior, accessibility and focus, and verification targets. Do not imply that a prototype implements production behavior.
