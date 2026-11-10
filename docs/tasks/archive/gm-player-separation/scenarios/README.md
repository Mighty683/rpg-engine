# Proposed end-to-end scenarios

These Gherkin files propose user journeys for review. They are not included in the
test runner and do not yet have step definitions. Move the agreed scenarios into
`packages/tests/src/features/` when implementing them.

- [Invitations](invitations.feature): game and character links, acceptance, and link controls.
- [Character control](character-control.feature): sheet access, active selection, assignment, and removal.
- [Game management](game-management.feature): accounts, per-game roles, membership, and access.
- [Live collaboration](live-collaboration.feature): updates, access loss, reconnect, and draft recovery.

These are browser journeys. Adversarial API authorization checks live in [`packages/tests/src/api`](../../../../../packages/tests/src/api/permissions.integration.test.ts). They exercise direct bypass attempts and state preservation; keep browser scenarios focused on user-visible behavior. Database constraints and competing transactions need focused integration tests as described in the [technical design](../tech.md).
