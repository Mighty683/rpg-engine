Feature: GM table Agent chat
  Scenario Outline: GM-E2E-01 — Use the compact chat alongside the table
    Given the Agent game has Robert and Christine at the table
    When the GM opens the Agent game at <width> pixels wide
    And asks the Agent who is in the party with Enter
    And keeps a draft while visiting Throw history
    Then the party reply and draft are visible in the compact chat
    Examples:
      | width |
      | 793   |
      | 360   |

  Scenario: GM-E2E-02 — Recover an unavailable draft
    Given the Agent game has Robert and Christine at the table
    And the Agent backend is disabled
    When the GM opens the Agent game at 793 pixels wide
    And writes a draft while the Agent is unavailable
    Then reopening the chat preserves the unavailable draft
    When the Agent becomes available and the GM submits the draft
    Then the completed party turn appears once and clears the submitted draft

  Scenario: GM-E2E-03 — Read older messages without losing the reading position
    Given the Agent game has Robert and Christine at the table
    And the Agent backend restarts with 45 completed turns
    When the GM opens the Agent game at 793 pixels wide
    Then chat opens at the bottom of the latest 20 completed turns
    When the GM scrolls to the beginning of the loaded chat
    Then the older turns appear above the same visible message
    When the GM completes a turn in a second session
    Then the first session stays at its reading position
    When the GM loads the remaining five turns and returns to the bottom
    Then all 46 turns appear once in chronological order

  Scenario: GM-E2E-07 — Advise from learned skills
    Given the Agent game has Robert and Christine at the table
    And Robert learned an accuracy skill and a damage skill
    When the GM opens the Agent game at 793 pixels wide
    And asks "What skill can use Robert to make better shot?"
    Then the Agent reads Robert's skills and explains the accuracy trigger and cost

  Scenario: GM-E2E-10 — Keep the Agent off the player table
    Given the Agent game has Robert and Christine at the table
    And the GM has a saved Agent conversation
    When the player opens the Agent game
    Then the player sees the party and no Agent chat or history request

  Scenario: Remove a rejected optimistic message while keeping the next draft
    Given the Agent game has Robert and Christine at the table
    When the GM opens the Agent game at 793 pixels wide
    Then a pending message appears immediately and a rejected send removes it and shows an error
