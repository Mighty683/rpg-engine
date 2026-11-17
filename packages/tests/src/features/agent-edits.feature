Feature: Review Agent profile changes
  Background:
    Given the GM opens an Agent game with Robert at 10 HP and hidden Agile with a saved attack

  Scenario: GM-E2E-08 Review a character change against a concurrent edit
    When the GM asks the Agent for "Set Robert's HP to 8"
    And reviews the proposed profile change
    Then the proposed diff reads "Current HP · 10 → 8"
    When a second GM session changes Robert's HP to 9
    And the GM accepts the stale character edit
    Then the conflict refreshes the review to "Current HP · 9 → 8"
    When the GM accepts the refreshed character edit
    Then Robert's sheet shows 8 HP after reload

  Scenario: GM-E2E-09 Cancel and then approve a hidden NPC edit
    When the GM asks the Agent for "Set Agile's notes to guarding the bridge"
    And reviews the proposed profile change
    Then the proposed diff reads "GM notes · Hidden ambush → guarding the bridge"
    When the GM dismisses the proposed profile change
    Then Agile still has the original notes
    When the GM asks the Agent for "Set Agile's notes to guarding the bridge"
    And reviews the proposed profile change
    And the GM accepts the reviewed NPC edit
    Then Agile's sheet shows the new notes, saved attack and hidden visibility after reload
