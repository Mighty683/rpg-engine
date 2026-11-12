---
name: task-ui
description: Design and prototype the UI solution for an agreed task flow.
---

# Task UI

## Way of working

Write or update `docs/tasks/<task>/ui.md`. Document the affected screens and components, visual decisions, behavior, accessibility and focus, and verification targets.

Create a reviewable prototype under `packages/frontend/prototypes/<task>/` and register it in the gallery, following `packages/frontend/prototypes/README.md`. Create first simple iteration of topic, basic layout.
Follow the agreed UX, [UI conventions](../../../docs/spec/ui.md), and [code conventions](../../../docs/spec/code-conventions.md). Reuse established components and tokens. Then iterate on the prototype together with the user. Purely presentational prototypes do not require tests; stateful interactions must follow the [testing conventions](../../../docs/spec/testing.md) and cover consequential behavior such as saving, selection, and edit/display synchronization.

Build reusable UI components. Keep mocks and gallery controls separate. Reuse the approved components and styles in production. Do not rebuild them.

Before approval, place reusable views and their screen composition in the owning module under `packages/frontend/src/`. Have Histoire render them with mock services. If the design requires a breaking change, use a separate view and keep existing routes and component contracts intact until implementation migrates their callers. Record the approved story, shared component paths, and deliberate differences in `ui.md`.

## Prototype architecture

- Keep stories thin: compose the prototype and expose review controls. Put application state, API calls, and mutations in controllers or composables; views receive data and callbacks. For existing flows, mount production components and controllers with injected services rather than recreating their navigation, loading, or save behavior in the prototype. Extract shared composition when necessary; keep only genuinely new behavior prototype-owned.
- Obtain API services through Vue `provide` / `inject`, using `useApiServices()` for existing contracts. Configure dependencies at the composition root, not through intermediate component props. Missing providers must fail explicitly; never fall back to production services.
- Use the shared MSW backend under `packages/frontend/prototypes/mock-backend/` and the composition helpers in `packages/frontend/prototypes/api.ts`. Histoire starts interception before mounting stories. Do not start another worker or contact a live backend. For domains without a production API, define a typed, explicitly injected prototype adapter and corresponding shared MSW handlers.
- Keep deterministic seed data and mock persistence separate from stories and views. Character sheets, cards, lists, and other projections must read the same saved records. After a successful mutation, refresh or update dependent state; do not maintain unrelated editable and display fixtures.
- Keep draft and saved state distinguishable. Match the agreed save behavior, preserve drafts on failure, and guard against accidental loss when switching records. Document any deliberate difference from production behavior, scenario controls, and reset behavior.
  Apply draft protection only where the agreed editing flow calls for drafts.
- Verify stateful flows against the shared MSW handlers, including record selection, persistence, edit/display synchronization, and relevant error or read-only states. Use `data-testid` selectors for browser tests. Run the prototype typecheck/build before handoff.

## Output

- Visual code which is ready for implementation in application and integration with data sources
- Documentation of UI decisions
