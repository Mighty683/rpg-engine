# Shared multi-process events

**Created:** 2026-11-14
**Status:** Deferred

No work planned. Revisit only if deployment requires multiple backend processes; see [technical decisions](../../spec/tech.md).

Deployment prerequisite before running more than one backend process. The current in-memory event registry supports one process only.

Define shared event delivery and session/membership revocation across processes, reconnect behavior, and missed-event recovery. Select topology and infrastructure in a separate technical design; the backend architecture hardening task does not introduce a broker or durable delivery guarantee.

Acceptance must include two-process tests for logout and membership revocation, private/public audience isolation, reconnect and missed-event recovery, and bounded resources during transport failure. Preserve transaction commit before event publication.

Origin: [Backend architecture hardening](../archive/backend-architecture-hardening/summary.md).
