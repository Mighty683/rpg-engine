# Backend architecture hardening

**Created:** 2026-11-14
**Status:** Plan

Improve backend reusability, security, and module boundaries while retaining Express, PostgreSQL, Drizzle, and the existing API behavior. Build on the current NPC Ajv validation slice. Use exclusive agent file ownership and staged transfers to avoid concurrent edits to shared files.

## Task documents

1. [Acceptance and verification handover](handover.md)
2. [Multi-agent implementation plan](plan.md)

Waves 0–3 are complete and reviewed: shared contracts, runtime/security, JSON Schema request validation, and character mapping. The combined delivery passed 174 backend/lint tests, 43 PostgreSQL API tests, 9 backend PostgreSQL tests, backend type-check, and `pnpm check`. A dev-entry smoke verified authenticated SSE and SIGTERM shutdown. Waves 4–6 (domain ownership, architecture/schema enforcement, and final verification) have not been dispatched. Multi-process event delivery remains a separate deployment prerequisite.
