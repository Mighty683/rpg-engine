# Private rolls

**Created:** 2026-11-12
**Status:** Implemented

Explore support for rolls that are not visible to every game member. Define the audience, controls, history and live-update behavior during the task's discovery and design phases.

## Discovery

- [UX journey](ux.md) — author-only private rolls and proposed history behavior.
- [UI specification](ui.md) — checkbox, history presentation and verification targets; no prototype requested.
- [Technical design](tech.md) — persistence, access control, pagination and event delivery.
- [Proposed OpenAPI](openapi.yaml) — affected throw operations for review.

## Related tasks

- [NPCs and enemies](../npcs-and-enemies/summary.md) — NPC rolls are public in that task; private rolls are separate work.

## Outstanding verification

Database-backed privacy and migration tests were not run because `TEST_DATABASE_URL` was not configured. The reported HTTP 500 after implementation has not been confirmed resolved; apply the migration and verify the history request.
