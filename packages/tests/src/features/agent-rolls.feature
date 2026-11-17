Feature: Review Agent rolls at the GM table
  Background:
    Given the GM opens the Agent with Robert, Christine, two hammers and hidden Agile

  Scenario: GM-E2E-04 Resolve an ambiguous hammer before rolling
    When the GM asks the Agent for "Robert attacks Agile with hammer"
    Then the Agent asks which hammer and history remains empty
    When the GM asks the Agent for "War Hammer"
    And reviews the proposed roll
    Then the review identifies Robert, Agile and the War Hammer accuracy setup
    When the GM confirms the proposed check
    Then one public accuracy result omits Agile and leaves its HP unchanged

  Scenario: GM-E2E-05 Check current agility for tumbling
    When the GM asks the Agent for "Christine make check roll for agility when tumbling"
    And reviews the proposed roll
    Then the review shows Christine with two current DEX d8 and the Tumbling note
    When the GM confirms the proposed check
    Then one attribute result shows both faces and the total

  Scenario: GM-E2E-06 Reroll a private GM free roll
    When the GM asks the Agent for "Make 2x10d roll"
    And reviews the proposed roll
    And makes the roll private and confirms
    Then one private GM roll shows both d10 faces and their sum
    When the GM stays in chat and requests "Reroll my last private throw"
    And reviews the proposed roll
    And confirms the proposed private reroll
    Then history preserves the first private result and adds a second
