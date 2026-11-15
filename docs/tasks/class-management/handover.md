# Class management — handover

**Created:** 2026-11-15 · [Story](story.md) · [UX and prototypes](ux.md) · [Technical design](tech.md) · [OpenAPI](openapi.yaml)

## Acceptance

- A GM can create and edit Fabula Ultima templates in a private library, copy one into a game, and save the game class back as a new or updated template. Copies have independent identities and edits. Saving to the library keeps the game class and its assignments.
- The GM can manage any character's progression. A player can manage their own. New sheets start at level 5 with 50 / 50 EXP. Adding a class level spends 10 Current EXP and removing one refunds 10. Character-level and skill-rank edits leave EXP unchanged. Preserve existing manual entries.
- The sheet, party table, and default rolls agree on automatic effects. Class free benefits apply at level 1. Rank-scaled modifiers follow saved skill ranks. Text effects remain inspectable, and current HP, MP, and IP stay as entered.
- Confirm removal of learned skills with the current list of affected characters and ranks. Cancellation preserves the definition and allocations. Confirmed removal drops those ranks and recalculates effects while preserving class levels and EXP. A game class can be removed once it is unassigned.
- Reuse the approved screens and optimistic save behavior. Route API errors through actionable toasts. The GM and player share character and party views with role-appropriate controls.

## Browser E2E tests

Implement these journeys in `packages/tests` with Gherkin, domain steps, and page objects.

```gherkin
Feature: Class management
  Scenario: E2E-01 — Reuse a library template
    Given a GM has a Fabula Ultima game and an empty class library
    When the GM creates a template with a free benefit and a ranked skill
    And the GM copies it into the game and later edits the library template
    Then the game copy still shows the original definition after reload
    When the GM saves the game copy as a new template
    And saves it again by updating the original template
    Then the library shows both saved templates and the same game copy remains available

  Scenario: E2E-02 — Advance a character from the player view
    Given a player has joined a Fabula Ultima game with a class available and another party member
    When the player creates a character and opens its sheet from the party table
    Then the new character starts at level 5 with 50 / 50 EXP
    And the player has no progression controls for the other party member
    When the player adds a class with a free modifier to the new character
    And learns one skill from that class
    Then the sheet shows 40 / 50 EXP and the sheet and party card reflect the modifier
    And the new character has one rank in the learned skill
    When the player edits character level, clears the skill rank, and lowers the class level
    Then EXP changes only for the class refund and the modifier is removed
    And reopening the sheet shows the saved level and 50 / 50 EXP

  Scenario: E2E-03 — Remove a learned skill and then an unused class
    Given the GM and a player have a game open and the player's character uses a class skill
    When the GM attempts to remove the skill and cancels after seeing the affected character
    Then the skill and its rank stay visible
    When the GM repeats the removal and confirms it
    Then the open player sheet loses the skill and keeps its class level and EXP
    When the GM clears the remaining assignments and removes the game class
    Then it is absent from the game catalog and class picker after reload

  Scenario: E2E-04 — Reconcile an uncertain progression save
    Given a player has their sheet open
    When a class allocation displays optimistically and the server saves it but the response is lost
    Then an actionable toast offers reconciliation and the optimistic allocation and EXP stay visible
    When the player refreshes through the offered action
    Then the allocation is saved and Current EXP is debited once
    And the player can continue editing
```

Compare the production library, game classes, player sheet, and table drawer with their linked prototypes on desktop and narrow screens. Include empty and loading states, pending edits, failure feedback, and the removal dialog. Record the comparison under verification evidence.

## API integration tests

Run against disposable PostgreSQL in `packages/tests/src/api`. Assert persisted state and verify rejected writes leave it intact.

| Check | Required coverage |
| --- | --- |
| API-01 — Catalog access | Anonymous requests return 401. Accounts can manage only their own templates. Active game members can read the game catalog. Player mutations and invalid CSRF or Origin return 403. Foreign templates, cross-game IDs, and unavailable game access return 404. Rejected writes leave records intact. |
| API-02 — Copies and retries | Copy a template twice with fresh identities. Verify independent definitions and child IDs. Stale source and destination revisions leave records intact. Matching create retries return the prior live result without duplicates. Conflicting reuse returns `id_conflict`. Saving as new or replacing an existing template preserves the source game class. |
| API-03 — Character access and compatibility | GM and controller can read and write managed progression. A different member receives the existing sheet with managed progression omitted and cannot patch it. Public party data omits EXP and learned ranks. Existing sheets keep their level, manual fields, and their normal PATCH behavior. |
| API-04 — EXP and allocation transactions | Verify default 50 / 50 EXP, class debit and refund, stable Total, and independent character level and skill ranks. Check combined manual EXP and allocation against the pre-allocation balance. Reject insufficient EXP, invalid ranks and limits, duplicate or foreign IDs, and stale revisions without partial writes. Concurrent requests using the same revision apply at most one debit. |
| API-05 — Shared effects | Verify free and rank-scaled modifiers, signed die steps, armor and override precedence, and preserved current resources. Compare character and party projections and default roll dice. Explicit roll dice and existing roll history retain their behavior. |
| API-06 — Save while assigned and safe deletion | Saving an in-use game class as new or over a template keeps class identity, assignments, EXP, and character revisions. Deletion fails with `class_in_use` until the last allocation is cleared, then removes only the game class. |
| API-07 — Skill removal and invalidation | An unconfirmed request returns the affected character IDs, names, and ranks with no writes. Changed impact requires fresh confirmation. Valid confirmation removes ranks atomically and keeps class levels and EXP. Reject lowering a skill cap below a learned rank. Verify affected revision increments and sheet and roster events after commit. |

For API-01, send valid edit requests with valid session and CSRF credentials so each case exercises ownership:

- Another account PATCHes a private template at `/api/library/class/{templateId}`. Expect 404.
- A player PATCHes a class definition in their own game at `/api/games/{gameId}/classes/{gameClassId}`. Expect 403.
- A GM PATCHes a class from another game through their own game's route. Expect 404.

After each attempt, read as the owner and verify the definition and revision are unchanged.

## Verification evidence

Pending implementation and execution. Record the tested revision, commands, outcomes, and production screen comparisons here.
