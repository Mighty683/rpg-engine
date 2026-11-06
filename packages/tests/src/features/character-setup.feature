Feature: Character setup
  A game master can prepare a player's named characters and choose the active one.

  Scenario: Create two characters and select the active character
    Given the games list is empty
    When I create game "Starfall Isles" with system "fabula-ultima"
    And I open game "Starfall Isles"
    And I add player "Alex"
    And I open player "Alex"
    And I create character "Camilla"
    And I edit the character theme to "Moonlit scholar" and HP to 9
    And I reload the character sheet
    Then the character sheet shows theme "Moonlit scholar" and HP 9
    And I return to the player page
    And I create character "Rowan"
    And I return to the player page
    Then character "Camilla" is in the character list
    And character "Rowan" is in the character list
    When I set character "Rowan" active
    Then character "Rowan" is active
    When I reload the page
    Then character "Rowan" is active
    When I open the game overview
    Then player "Alex" shows active character "Rowan"
    When I open player "Alex"
    When I clear the active character
    Then no character is active
