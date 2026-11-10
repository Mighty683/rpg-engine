Feature: Character control and visibility
  The GM can manage every sheet, while players edit only sheets assigned to them.
  Active status determines the workspace tabs, not whether a sheet can be read.

  Scenario: A GM creates and activates characters without players
    Given Robin is the GM of "The Lantern Road" and no players have joined
    When Robin creates characters "Rowan" and "Nera" in "The Lantern Road"
    Then "Rowan" and "Nera" are GM-controlled and inactive
    And Robin can open and edit both sheets in characters management
    When Robin makes "Rowan" and "Nera" active in "The Lantern Road"
    Then both "Rowan" and "Nera" appear as character tabs
    When Robin reloads "The Lantern Road"
    Then both "Rowan" and "Nera" remain active

  Scenario: A player reads all sheets but edits only their own
    Given Mira is a player in "The Lantern Road" and controls "Nera"
    And "Rowan" is an inactive GM-controlled character in "The Lantern Road"
    When Mira opens "Rowan" from characters management
    Then Mira can read the full sheet and notes for "Rowan"
    And the sheet for "Rowan" is read-only
    And "Rowan" remains inactive
    When Mira opens "Nera" from characters management
    Then Mira can edit and save the sheet for "Nera"

  Scenario: A player's first character becomes active and later characters do not
    Given Mira is a player in "The Lantern Road" with no active character
    When Mira creates characters "Nera" and "Ellis" in "The Lantern Road"
    Then Mira controls both "Nera" and "Ellis"
    And "Nera" is Mira's active character in "The Lantern Road"
    And "Ellis" is inactive in "The Lantern Road"
    When Mira selects "Ellis" as her active character
    Then "Ellis" replaces "Nera" in the character tabs
    When Mira selects None as her active character
    Then neither "Nera" nor "Ellis" appears as Mira's active tab
    And both sheets remain in characters management

  Scenario: Reassignment preserves the sheet and clears its active status
    Given Mira is a player in "The Lantern Road" and controls active character "Nera"
    And Ellis is another player in "The Lantern Road"
    And "Nera" has the theme "Moonlit scholar"
    When Robin assigns "Nera" to Ellis in "The Lantern Road"
    Then Ellis controls "Nera" and "Nera" is inactive
    And Mira has no active character in "The Lantern Road"
    And the sheet for "Nera" still has the theme "Moonlit scholar"
    And Mira can read but cannot edit "Nera"
    And Ellis can edit "Nera"
    When Robin takes "Nera" back under GM control
    Then "Nera" is GM-controlled and inactive
    And the sheet for "Nera" still has the theme "Moonlit scholar"

  Scenario: The GM changes and clears a player's active character
    Given Mira is a player in "The Lantern Road" and controls "Nera" and "Ellis"
    And "Nera" is Mira's active character in "The Lantern Road"
    When Robin makes "Ellis" active in "The Lantern Road"
    Then "Ellis" is Mira's active character and "Nera" is inactive
    And Mira still controls both "Nera" and "Ellis"
    When Robin makes "Ellis" inactive in "The Lantern Road"
    Then Mira has no active character in "The Lantern Road"

  Scenario: A player permanently removes their active character
    Given Mira is a player in "The Lantern Road" and controls active character "Nera"
    When Mira chooses to remove "Nera" in characters management
    Then the confirmation names "Nera" and says removal is permanent
    When Mira confirms the removal of "Nera"
    Then "Nera" is absent from characters management and the character tabs
    And Mira has no active character in "The Lantern Road"
    And Robin no longer sees "Nera" in "The Lantern Road"

  Scenario: A player cannot remove another controller's character
    Given Mira is a player in "The Lantern Road"
    And "Rowan" is a GM-controlled character in "The Lantern Road"
    When Mira opens "Rowan" in characters management
    Then Mira cannot remove "Rowan"
    And "Rowan" remains in "The Lantern Road"
