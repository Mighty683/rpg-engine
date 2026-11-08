Feature: Character setup
  A game master can prepare characters and choose which are active.

  Scenario: Create characters and select the active character
    Given the games list is empty
    When I create game "Starfall Isles" with system "fabula-ultima"
    And I create character "Camilla"
    And I edit the character theme to "Moonlit scholar" and HP to 9
    And I reload and reopen character "Camilla"
    Then the character sheet shows theme "Moonlit scholar" and HP 9
    When I return to the game table
    And I create character "Rowan"
    And I return to the game table
    And I open character management
    Then character "Camilla" is in the character list
    And character "Rowan" is in the character list
    When I set character "Rowan" active
    Then character "Rowan" is active
    When I reload the page
    And I open character management
    Then character "Rowan" is active
    When I set character "Rowan" inactive
    Then character "Rowan" is inactive
