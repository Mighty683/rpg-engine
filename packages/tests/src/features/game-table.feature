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
