Feature: Game creation
  A game master can create a game and return to it later.

  Scenario: Create a game that persists after reloading
    Given the games list is empty
    When I create game "First adventure" with system "fabula-ultima"
    Then creation of game "First adventure" is confirmed
    And "First adventure" is in the games list
    When I reload the page
    Then "First adventure" is in the games list
    And game "First adventure" uses system "Fabula Ultima"
