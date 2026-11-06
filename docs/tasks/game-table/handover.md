# Game Table — handover

**Created:** 2026-11-06

**Sources:** [Story](story.md) · [UX](ux.md) · [UI](ui.md) · [Technical design](tech.md)

## Acceptance goals

- The Fabula Ultima workspace shows the live active party and shared throw history. The sheet drawer, character management, and GM Settings remain available.
- The GM can make a free roll as GM or any active character, including one controlled by a player. Players roll as their own active character. The submitting account owns the history entry.
- Attribute, weapon, free, and opposed rolls follow the technical design. Confirming a reroll creates a new entry with the reviewed setup. Temporary choices leave the character sheet unchanged.
- History survives reloads and reflects committed changes across viewers. Only the GM and the entry's author can remove it while they have game access.

## Browser E2E tests

Implement the following journeys in `packages/tests` using Gherkin and the existing page-object conventions. Assert visible behavior and use deterministic fixtures where an outcome matters.

```gherkin
Feature: Fabula Ultima Game Table

  Scenario: E2E-01 — The GM reviews the party and opens its sheets
    Given a Fabula Ultima game with active GM and player characters and an inactive character
    When the GM opens the Game Table
    Then the party shows the active characters and their compact sheet data
    When the GM opens Character sheets and switches tabs
    Then the selected sheet and controller are visible
    When the GM closes the drawer, visits Settings and returns
    Then the Game Table is visible again

  Scenario: E2E-02 — The GM rolls from a character and rerolls from history
    Given an active character with a configured weapon
    When the GM submits an attribute roll with a temporary die size, modifier and note
    Then history shows the submitted setup and the sheet retains its saved die size
    When the GM submits the weapon's accuracy roll
    Then history shows the weapon and its accuracy result
    When the GM opens Reroll and cancels
    Then history is unchanged
    When the GM opens Reroll again, edits the note and confirms
    Then history contains both the original roll and the new result

  Scenario: E2E-03 — The GM and player make free rolls
    Given a GM and a player with active characters in the same game
    When the GM opens Make a roll
    Then the pool is empty and Roll as offers GM and all active characters
    When the GM submits an opposed free roll as the player's character
    Then history shows both sides, their totals, the outcome and GM attribution
    When the player makes a free roll
    Then the roll is attributed to the player's active character

  Scenario: E2E-04 — Viewers share throw history
    Given the GM and a player have the same Game Table open in separate sessions
    When the player submits a roll
    Then the GM sees it appended without reloading
    And the roll remains visible after the GM reloads
    When the GM removes the roll
    Then it disappears from the player's history
    And it stays absent after a reload

  Scenario: E2E-05 — The player changes their active character
    Given a player controls two characters and has no active character
    When the player tries to make a roll
    Then the table directs them to select an active character
    When the player selects their first character and makes a free roll
    And the player switches to their second character and makes another free roll
    Then the party shows the second character as active
    And history attributes each roll to the character active when it was made

  Scenario: E2E-06 — The GM finishes setting up a weapon from its sheet
    Given an active character has a weapon with incomplete accuracy settings
    When the GM tries to roll with that weapon from the party card
    Then the card directs the GM to the character sheet
    When the GM saves the weapon's accuracy settings and returns to the table
    Then the weapon card shows the configured attributes
    When the GM rolls with the weapon
    Then history shows its accuracy result

  Scenario: E2E-07 — The GM reviews older throws and returns to rolling
    Given a game has more throws than fit in the first history page
    When the GM opens the Game Table
    Then history opens at the latest throw
    When the GM scrolls back and loads older throws
    Then the older throws appear in order and the visible entry keeps its position
    When the GM makes a new free roll
    Then history scrolls to the new result at the bottom

  Scenario: E2E-08 — The GM rerolls an opposed check from history
    Given history contains an opposed check with a modifier on each side and a note
    When the GM opens Reroll for that check
    Then the setup shows the saved friendly and opposing dice, both modifiers, and the note
    When the GM changes the opposing modifier and confirms
    Then history shows both the original result and the new opposed result
```

## API integration tests

Implement in `packages/tests/src/api` against PostgreSQL. For rejected writes, assert that the affected persisted state and history are unchanged.

| Check | Required coverage |
| --- | --- |
| API-01 — Existing permission coverage | Split the existing suite by game access and membership, character permissions, invitations, and session and origin guards. Preserve cross-resource revocation and persisted-state assertions for ordinary requests. Drop the lock-coordinated removal and reassignment cases during the split. Share setup and use a separate schema for each suite. |
| API-02 — Access and attribution | Deny anonymous, outsider, and removed-member access as applicable. Reject cross-game IDs and player attempts to roll as another character. Allow GM free rolls and free rerolls as active player-controlled characters, retain the GM as author, and reject inactive selections. Verify the player's active character at submission, including a missing active character. |
| API-03 — Roll validation | Reject stale sheet revisions and selections that became inactive or lost permission after a completed change. Reject foreign or incomplete weapons, malformed pools and modifiers, and forged authoritative fields. |
| API-04 — History | Verify stable cursor ordering and no duplicates across pages. Renaming a character or weapon leaves earlier attribution and setup intact. |
| API-05 — Reroll and removal | Require current game and character permissions for rerolls and scope source IDs to the game. Verify that a weapon reroll uses the original saved accuracy setup and that the source result stays intact. Verify author and GM removal, rejection for other players, and disappearance from history after removal. |

## Verification evidence

Both suites are pending implementation. Record the test commands, results, and any unresolved failures here before marking the task Implemented.

Run the API suites with `pnpm --filter @rpg-engine/tests test:api` and the browser suites with `pnpm --filter @rpg-engine/tests test`. Set `TEST_DATABASE_URL` to a disposable PostgreSQL database for both. Confirm the API suites ran with the database configured, since they can be skipped without it.
