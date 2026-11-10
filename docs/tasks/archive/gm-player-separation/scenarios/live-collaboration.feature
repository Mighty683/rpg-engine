Feature: Live game collaboration
  Open game views reflect committed changes while preserving unsaved edits.

  Scenario: Active tabs update for another member without a page reload
    Given Robin and Mira have "The Lantern Road" open in separate browser sessions
    And "Rowan" is an inactive GM-controlled character in "The Lantern Road"
    When Robin makes "Rowan" active
    Then Mira sees the "Rowan" character tab without reloading
    When Robin makes "Rowan" inactive
    Then the "Rowan" character tab disappears for Mira without reloading

  Scenario: A remote sheet save does not overwrite a local draft
    Given Robin and Mira have the editable sheet for "Nera" open in separate browser sessions
    And Mira has an unsaved local change to "Nera"
    When Robin saves a different change to "Nera"
    Then Mira's local change remains visible
    And Mira can review the latest saved version of "Nera"
    When Mira's save conflicts with Robin's saved revision
    Then Mira is told about the conflict and the local change is retained

  Scenario: Removing access closes an open game view
    Given Robin and Mira have "The Lantern Road" open in separate browser sessions
    When Robin removes Mira's access to "The Lantern Road"
    Then Mira is told that the game can no longer be opened
    And Mira can return to her available games
    And Mira cannot read or save sheets in "The Lantern Road"

  Scenario: A player keeps a draft when control of the open sheet changes
    Given Mira controls "Nera" in "The Lantern Road" and has its sheet open
    And Mira has an unsaved local change to "Nera"
    When Robin takes "Nera" back under GM control
    Then Mira is told that the edit could not be saved
    And Mira can read the latest saved sheet for "Nera"
    And Mira's local change is retained for review and is not saved automatically

  Scenario: Reconnecting refreshes changes missed while disconnected
    Given Robin and Mira have "The Lantern Road" open in separate browser sessions
    And Mira's live connection to "The Lantern Road" is interrupted
    When Robin makes "Rowan" active and saves a change to "Rowan"
    And Mira's live connection to "The Lantern Road" reconnects
    Then Mira sees "Rowan" as active and can see the latest saved sheet
