Feature: Accounts and game management
  Game access and role are determined separately for each signed-in account and game.

  Scenario: A new account creates and reopens a game as its GM
    Given Robin does not have an account
    When Robin registers and creates the Fabula Ultima game "The Lantern Road"
    Then Robin sees "The Lantern Road" with the GM role
    When Robin signs out and signs back in
    Then Robin can reopen "The Lantern Road" as its GM

  Scenario: The same account has different roles in different games
    Given Robin is the GM of "The Lantern Road"
    And Robin is a player in "Starfall Isles"
    When Robin opens the games list
    Then "The Lantern Road" shows Robin's role as GM
    And "Starfall Isles" shows Robin's role as Player
    When Robin opens "Starfall Isles"
    Then Robin cannot access GM settings for "Starfall Isles"

  Scenario: An account cannot open a game it has not joined
    Given Robin is the GM of "The Lantern Road"
    And Ellis is not a member of "The Lantern Road"
    When Ellis opens a direct link to "The Lantern Road"
    Then Ellis is told the game cannot be opened
    And Ellis can return to their available games

  Scenario: Removing and restoring a player preserves their characters
    Given Robin is the GM of "The Lantern Road"
    And Mira is a player in "The Lantern Road" and controls active character "Nera"
    And Robin has a game invitation link for "The Lantern Road"
    When Robin removes Mira's access to "The Lantern Road"
    Then Mira cannot open "The Lantern Road" or rejoin using its game invitation link
    And "Nera" remains in "The Lantern Road" under GM control and is inactive
    When Robin restores Mira's access to "The Lantern Road"
    Then Mira can open "The Lantern Road" as a player
    And "Nera" remains GM-controlled and inactive
    And Mira has no active character in "The Lantern Road"

  Scenario: Signing out clears the previous account's protected view
    Given Robin is signed in and can open "The Lantern Road" as GM
    And Ellis has an account that cannot access "The Lantern Road"
    When Robin signs out and Ellis signs in on the same browser
    Then Ellis does not see "The Lantern Road" in the games list
    And Ellis cannot open Robin's previously viewed game or character sheets
