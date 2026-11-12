# NPCs and enemies — handover

**Created:** 2026-11-12
**Sources:** [Story](story.md) · [UX](ux.md) · [UI](ui.md) · [Technical design](tech.md)

## Acceptance goals

- A GM can create, edit, save, reopen and remove game-scoped NPCs and their ordered attacks. Cards and sheets show the same saved data; manual stats and notes persist. NPC rank and damage automation are outside scope.
- Players see no hidden NPCs, only name and relationship for visible NPCs, and saved stats and attacks for known NPCs. GM notes and controls remain private. The server enforces these projections and game membership on every relevant request.
- The GM can roll NPC attributes and attacks using Fabula rules; history and rerolls retain their snapshots and are visible to game members, even when the NPC itself is hidden. Existing shared rolls continue to work.
- Saved changes reach connected viewers through safe invalidation and refetch; reconnect and focus recover missed updates. Edits use the existing optimistic UI pattern without a general save button or unsaved-change guards.
- Reuse the reviewed prototype's components and visual behavior in production, adapted to production contracts. Support keyboard navigation, focus, pending and error states across relevant screen sizes.

## Implementation decisions

- The prototype is approved as the visual basis, adapted to optimistic updates and the project's validation conventions.
- Confirm NPC removal; reject stale revisions and preserve historical roll snapshots. The GM alone may remove an NPC.
- Use the existing in-process live delivery; shared multi-instance delivery is outside this task.

## Browser E2E tests

Implement complete journeys in `packages/tests` as Gherkin features with domain step definitions and page objects. Use deterministic fixtures where outcomes matter.

```gherkin
Feature: NPCs and enemies
  Scenario: E2E-01 — Prepare and reopen an NPC
    Given a GM has a game open
    When the GM creates an NPC with stats, notes and ordered attacks
    Then the table card shows the saved NPC data
    When the GM edits the NPC and adds, changes and removes attacks
    And the GM reopens the NPC
    Then the sheet and card show the same saved changes
    When the GM confirms removal of the NPC
    Then the NPC is absent after reload

  Scenario: E2E-02 — Change player visibility
    Given a GM and player have the same game open with a hidden NPC
    Then the player sees no NPC card or NPC tab
    When the GM changes the NPC to visible
    Then the player sees only its name and relationship with concealed stats
    When the GM changes the NPC to known
    Then the player sees saved stats and attacks without GM notes or controls
    When the GM changes the NPC to hidden
    Then the player no longer sees the NPC

  Scenario: E2E-03 — Roll and reroll an NPC action
    Given a GM has a saved NPC with an attack and a player has the same game open
    When the GM rolls an NPC attribute and its attack
    Then GM history shows the resolved setups and attack accuracy bonus
    And the player sees those rolls and their snapshots
    When the GM rerolls the attack from history
    Then GM and player history retain the original and show the new result

  Scenario: E2E-04 — Handle an optimistic update failure
    Given a GM is editing an NPC
    When the GM changes a field and the update fails or conflicts
    Then the GM receives actionable feedback and the view reconciles with the server
    When the GM switches NPCs or closes the panel
    Then no unsaved-changes prompt appears

  Scenario: E2E-05 — Operate the editor with a keyboard
    Given a GM has an NPC editor open
    When the GM uses keyboard controls to edit an NPC
    Then controls are labelled and focus remains visible
    When the GM uses Escape and close controls
    Then focus follows the existing table behavior without an unsaved-changes prompt
```

Review the approved design at relevant desktop and narrow screen sizes, including loading, empty, pending and failure states; record results below.

## API integration tests

Implement in `packages/tests/src/api` against PostgreSQL. Assert response projections and persisted effects; rejected writes leave NPCs, attacks and history unchanged.

| Check | Required coverage |
| --- | --- |
| API-01 — Access and projections | Exercise anonymous, outsider, player, GM and revoked membership access; list and detail at all visibility levels and transitions; verify no GM notes or concealed fields, hidden and cross-game IDs return no existence disclosure, and players cannot write. |
| API-02 — Create and validation | Persist valid manual fields and ordered attacks; reject malformed, unknown and invalid fields. Verify identical create retries after edits return the specified result without duplicates, conflicting retries and globally colliding IDs return `id_conflict` without disclosure. |
| API-03 — Updates and removal | Verify atomic replacement, attack ordering and omission, foreign or duplicate attack IDs, revision increments and concurrent stale updates. Verify authorized removal and rejected removal against the agreed contract, including persisted effects and history. |
| API-04 — NPC rolls | Verify GM authorization, game and attack ownership, revision checks, base and overridden dice, repeated attributes, modifiers, red dice, attack accuracy and snapshots. Reject invalid or forged setup and cross-game IDs without creating history. |
| API-05 — Shared history | Verify NPC rolls are visible to game members regardless of NPC visibility, stable pagination, shared-roll compatibility, removal and GM-only NPC reroll authorization, source scoping and current eligibility. Rerolls retain original attack metadata and snapshots; rejected operations leave history unchanged. |
| API-06 — Invalidation and revocation | Verify events after commit carry no NPC data or IDs, NPC throw hints reach game members through the shared throw mechanism, and revoked members cannot fetch data or perform writes. Exercise the agreed delivery topology and visibility revocation behavior. |

## Verification evidence

On 2026-11-12, `pnpm check` passed; `pnpm test` passed 87 tests across 20 files. `pnpm --filter @rpg-engine/backend build` passed. `pnpm --filter @rpg-engine/frontend build` passed with a bundle-size warning. `pnpm --filter @rpg-engine/frontend prototypes:build` passed, including prototype type-check, with existing Histoire setup and router warnings. `pnpm --filter @rpg-engine/frontend test:browser --run` passed 31 tests across nine files; the run logged a mock proxy connection warning.

With a dedicated local PostgreSQL database, `pnpm --filter @rpg-engine/tests test:api --run` passed 35 tests across nine files. The full browser suite `pnpm --filter @rpg-engine/tests test --run` passed 16 scenarios across four files. One earlier full run timed out on the existing player free-roll journey; its isolated suite and the subsequent full run passed. After that full run, the focused NPC suite passed all six scenarios with additional player redaction assertions.

The NPC journeys cover create, optimistic editing, level, notes, attribute dice, HP/MP and defenses across reload, attack add/edit/remove, attack roll and reroll, confirmed deletion, player visibility, redaction, public rolls and reconnect/focus revocation, failed updates, keyboard editing, Escape focus restoration, and loading and pending states. API coverage includes projections, membership and revocation, create retries and collisions, concurrent stale writes, cross-game access, invalid/foreign attacks and rolls, attack reorder/removal, base and repeated dice, opposed rolls, validation boundaries, mismatched or missing reroll sources, reroll snapshots after attack edits, public history and pagination, historical snapshots after deletion, and ID-free NPC events to GM and player.

Desktop and 390px editor screenshots, an empty NPC table, loading indicator, pending update, and failed-update toast were inspected. Visual review identified an overlapping character bookmark, a truncated visibility label, and an off-screen save indicator; these were corrected.

On 2026-11-12, the expanded NPC browser suite passed all six journeys, including every attribute die, maximum HP and MP, visible keyboard focus, narrow loading and error states, and player-visible NPC attack rolls and rerolls. Narrow 390px loading and failed-update screenshots were inspected. The focused PostgreSQL NPC integration suite passed both tests, including cross-game reroll-source rejection with unchanged history, and accepted and rejected validation boundaries. `pnpm check` passed after these additions. An initial browser rerun failed due to an ambiguous toast selector and a second failed because the attack card was collapsed; both test setup issues were corrected and the final run passed.
