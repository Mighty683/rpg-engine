Feature: Class management
  Scenario Outline: E2E-01 — Reuse a library template on a <layout> screen
    Given I open the empty class library for my Fabula Ultima game at width <width>
    When I create template "Guardian" with benefit "Vigor" that says "Stand firm." and skill "Deflect" ranked 3
    And I copy "Guardian" into my game and rename the library template "Library Guardian"
    Then my game's "Guardian" still has effect "Stand firm." and skill "Deflect" ranked 3 after reload
    When I save game class "Guardian" as new template "Guardian backup"
    And I save game class "Guardian" over library template "Library Guardian"
    Then my library contains "Guardian" and "Guardian backup" and the same "Guardian" game copy remains

    Examples:
      | layout  | width |
      | desktop | 1280  |
      | narrow  | 390   |

  Scenario Outline: E2E-02 — Advance a character from the player view at width <width>
    Given I play in a game with "Guardian" available and another party member at width <width>
    When I create and open the sheet for "Apprentice" from the party
    Then my sheet starts at level 5 with 50 of 50 EXP and other party sheets have no progression controls
    When I assign my first class and learn its first skill
    Then my sheet and party show its benefit and I have rank 1 with 40 of 50 EXP
    When I change my level, clear the rank, and refund the assigned class level
    Then my level and 50 of 50 EXP persist and the class benefit is gone

    Examples:
      | width |
      | 1280  |
      | 390   |

  Scenario: E2E-04 — Reconcile an uncertain progression save
    Given I play in a game with "Guardian" available and another party member at width 390
    When I create and open the sheet for "Apprentice" from the party
    And the save response is lost after my first class allocation commits
    Then the optimistic class and 40 of 50 EXP remain visible with a reload action
    When I reload the saved sheet through the offered action
    Then the saved class stays available, EXP was charged once, and I can still edit

  Scenario Outline: E2E-03 — Remove a learned skill at width <width>
    Given the GM and player have a game open with a learned "Deflect" skill in "Guardian" at width <width>
    When the GM reviews affected ranks and cancels removing the learned skill
    Then the class skill and the player's rank are unchanged
    When the GM confirms removal of the learned skill
    Then the player's open sheet loses the skill and its modifier but keeps the class level and EXP
    When the GM clears the remaining assignment and removes the game class
    Then the game class is absent from the catalog and class picker after reload

    Examples:
      | width |
      | 1280  |
      | 390   |
