Feature: Sharing and switching game tables

  Scenario: Two players share public rolls with distinct character attribution
    Given players "Mira" and "Sol" have the same game open in separate sessions
    When "Mira" rolls "Scout the pass"
    And "Sol" rolls "Guard the bridge"
    Then both players see "Scout the pass" rolled by "Mira"
    And both players see "Guard the bridge" rolled by "Sol"

  Scenario: Switching games restores the correct roster, role and roll history
    Given I run "Mountain Pass" as GM and play "Harbor Lights" as "Marin"
    When I choose "Mountain Pass" from my games
    Then I see GM settings and "Warden" in the party
    When I roll "Mountain weather"
    And I switch to "Harbor Lights" through my games
    Then I see player controls for "Marin" and no "Warden" in the party
    When I roll "Harbor watch"
    Then my history contains only "Harbor watch"
    When I switch to "Mountain Pass" through my games
    Then I see GM settings and "Warden" in the party
    And my history contains only "Mountain weather"

  Scenario: A player outside another game cannot discover or open its table
    Given "Mira" plays in "Mountain Pass" and "Sol" plays separately in "Harbor Lights"
    When "Sol" rolls "Secret harbor signal"
    And "Mira" rolls "Mountain signal"
    Then "Mira" sees only "Mountain signal" in history
    And "Sol" sees only "Secret harbor signal" in history
    When "Mira" returns to the games list
    Then "Mountain Pass" is in the games list
    And "Harbor Lights" is absent from my games
    When I follow the direct table link for "Harbor Lights"
    Then the game is unavailable and its table is hidden
