Feature: Invitations to a game
  The GM can invite players to join a game or claim a GM-controlled character.
  Opening an invitation does not itself join the recipient or assign a character.

  Scenario: A new player joins through a reusable game link after signing in
    Given Robin is the GM of "The Lantern Road"
    And Robin has a game invitation link for "The Lantern Road"
    And Mira has an account and is not a member of "The Lantern Road"
    When Mira opens the game invitation link while signed out
    And Mira signs in
    Then Mira sees an invitation to join "The Lantern Road"
    And Mira is not yet a member of "The Lantern Road"
    When Mira accepts the game invitation
    Then Mira is a player in "The Lantern Road" without an assigned character
    And Mira sees the character overview for "The Lantern Road"

  Scenario: A game link can be reused and an existing member opens the game
    Given Robin is the GM of "The Lantern Road"
    And Robin has a game invitation link for "The Lantern Road"
    And Mira is a player in "The Lantern Road"
    And Ellis has an account and is not a member of "The Lantern Road"
    When Mira opens the game invitation link for "The Lantern Road"
    Then Mira sees the character overview for "The Lantern Road"
    When Ellis opens and accepts the same game invitation link
    Then Ellis is a player in "The Lantern Road" without an assigned character
    And Mira remains a player in "The Lantern Road"

  Scenario: A new player joins and claims a character with the default active choice
    Given Robin is the GM of "The Lantern Road"
    And "Rowan" is a GM-controlled character in "The Lantern Road"
    And Robin has a character invitation link for "Rowan" in "The Lantern Road"
    And Mira has an account and is not a member of "The Lantern Road"
    When Mira opens the character invitation link for "Rowan" and signs in
    Then Mira sees "The Lantern Road" and "Rowan" in the invitation
    And the option to make "Rowan" active is selected
    And Mira is not yet a member of "The Lantern Road"
    When Mira accepts the character invitation for "Rowan"
    Then Mira is a player in "The Lantern Road" and controls "Rowan"
    And "Rowan" is Mira's active character in "The Lantern Road"
    And Mira sees the editable sheet for "Rowan"

  Scenario: An existing player claims a character without changing the active character
    Given Mira is a player in "The Lantern Road" and controls active character "Nera"
    And "Rowan" is a GM-controlled character in "The Lantern Road"
    And Robin has a character invitation link for "Rowan" in "The Lantern Road"
    When Mira opens the character invitation link for "Rowan"
    And Mira clears the option to make "Rowan" active
    And Mira accepts the character invitation for "Rowan"
    Then Mira controls "Rowan" in "The Lantern Road"
    And "Nera" remains Mira's active character in "The Lantern Road"
    And Mira sees the editable sheet for inactive character "Rowan" in characters management

  Scenario: Character links are independent until one is accepted
    Given "Rowan" is a GM-controlled character in "The Lantern Road"
    And Robin has two character invitation links for "Rowan" in "The Lantern Road"
    When Robin disables the first character invitation link for "Rowan"
    Then the first character invitation link for "Rowan" is unavailable
    And the second character invitation link for "Rowan" remains available
    When Mira accepts the second character invitation link for "Rowan"
    Then Mira controls "Rowan" in "The Lantern Road"
    And both character invitation links for "Rowan" are unavailable
    When Robin takes "Rowan" back under GM control
    Then both character invitation links for "Rowan" remain unavailable

  Scenario: Rotating a game link invalidates only its previous URL
    Given Robin is the GM of "The Lantern Road"
    And Robin has a game invitation link for "The Lantern Road"
    And Robin has a character invitation link for "Rowan" in "The Lantern Road"
    When Robin rotates the game invitation link for "The Lantern Road"
    Then the previous game invitation link for "The Lantern Road" is unavailable
    And the new game invitation link for "The Lantern Road" is available
    And the character invitation link for "Rowan" remains available

  Scenario: A disabled game link can be re-enabled without removing members
    Given Robin is the GM of "The Lantern Road"
    And Mira is a player in "The Lantern Road"
    And Robin has a game invitation link for "The Lantern Road"
    When Robin disables the game invitation link for "The Lantern Road"
    Then the game invitation link for "The Lantern Road" is unavailable
    And Mira can still open "The Lantern Road"
    When Robin re-enables the game invitation link for "The Lantern Road"
    Then the same game invitation link for "The Lantern Road" is available

  Scenario: Only one player can claim a character
    Given "Rowan" is a GM-controlled character in "The Lantern Road"
    And Robin has two character invitation links for "Rowan" in "The Lantern Road"
    And Mira and Ellis are not members of "The Lantern Road"
    When Mira and Ellis attempt to accept the links for "Rowan" at the same time
    Then exactly one player joins "The Lantern Road" and controls "Rowan"
    And the other player sees that the character invitation is unavailable
    And the other player is not a member of "The Lantern Road"

  Scenario: A failed character claim does not join the recipient
    Given Ellis has an account and is not a member of "The Lantern Road"
    And "Rowan" was assigned to Mira after its character invitation link was created
    When Ellis opens the old character invitation link for "Rowan"
    Then Ellis sees that the character invitation is unavailable
    And Ellis is not a member of "The Lantern Road"
