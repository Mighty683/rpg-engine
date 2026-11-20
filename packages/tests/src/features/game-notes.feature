Feature: Game notes

  The GM keeps a private per-game notebook: recent entries at the table, a
  searchable notes screen, autosaved rich-text entries, and no player access.

  Scenario Outline: E2E-01 — Consult recent entries from the table drawer
    Given a GM has a game with saved note entries at the table at <width> by <height>
    When the GM opens the Game notes EdgeTab
    Then the drawer shows the newest entries first with title, content and both dates
    When the GM scrolls the drawer to the bottom
    Then older entries load in order without losing the loaded cards
    When the GM selects an entry card
    Then the entry detail opens on the notes screen
    When the GM returns to the table and dismisses the drawer
    Then the table is restored at the same position with no unsaved-changes prompt

    Examples:
      | layout  | width | height |
      | desktop | 1280  | 800    |
      | narrow  | 390   | 844    |

  Scenario Outline: E2E-02 — Capture and reopen an entry
    Given a GM is on the notes screen of "The Lantern Road" at <width> by <height>
    When the GM opens New entry, enters a title and formatted body, and creates the entry
    Then a toast confirms and the saved entry detail opens with both timestamps
    When the GM reloads the page
    Then the entry is still there with the same saved content
    When the GM cancels a new entry
    Then the notes list shows again and the draft is preserved for the same game
    When the GM creates the preserved draft
    Then the second entry detail opens with the preserved title and body

    Examples:
      | layout  | width | height |
      | desktop | 1280  | 800    |
      | narrow  | 390   | 844    |

  Scenario Outline: E2E-03 — Search the whole notebook and browse newest first
    Given a GM has 25 saved entries in "The Lantern Road" and a fresh game with an empty notebook at <width> by <height>
    When the GM opens Search all entries with a blank query
    Then the first 20 entries are listed newest first
    And the drawer of the fresh game shows no entries yet
    When the GM searches "compass" inside an entry body, ignoring case
    Then the matching entries are listed and a non-matching query shows the no-match state
    When the GM searches "Routine" again
    Then the result list resets to the first page
    When the GM scrolls the results to the bottom
    Then the next page appends below the loaded cards and stops at the end
    When the GM selects a result by click or Enter on the focused title
    Then the entry detail opens, and Back to results keeps the search term

    Examples:
      | layout  | width | height |
      | desktop | 1280  | 800    |
      | narrow  | 390   | 844    |

  Scenario Outline: E2E-04 — Edit an entry with autosave
    Given a GM has an entry detail open at <width> by <height>
    When the GM edits the body without leaving the field
    Then the change shows immediately and saves after 2 seconds idle, even while focused
    When the GM edits the title and leaves the field
    Then the pending change flushes immediately
    And the list and metadata refresh from the server acknowledgement with local-time dates

    Examples:
      | width | height |
      | 1280  | 800    |
      | 390   | 844    |

  Scenario Outline: E2E-05 — Recover a failed or conflicting save
    Given a GM has an entry detail open at <width> by <height>
    When the network fails while the body edit is saved
    Then the GM gets a recovery toast and the typed draft stays editable
    When the GM explicitly retries
    Then the retained text is saved onto the refreshed server version
    When another session saves the same entry and the GM edits it again
    And the GM flushes their edit
    Then the conflict save is rejected with a recovery toast and the typed draft stays editable
    When the GM retries the conflict explicitly
    Then the retained text is reapplied only onto the refreshed server version
    When the next body save returns a confirmed rejection
    Then the view restores the acknowledged result while the draft stays editable

    Examples:
      | width | height |
      | 1280  | 800    |
      | 390   | 844    |

  Scenario Outline: E2E-06 — Keep notes private from players
    Given a GM has saved notes and a player has the same game open at <width> by <height>
    Then the player's table has no Game notes tab or drawer
    When the player visits the notes routes directly
    Then an unavailable screen appears with a route back and no notes request is made

    Examples:
      | width | height |
      | 1280  | 800    |
      | 390   | 844    |

  Scenario Outline: E2E-07 — Ask the Agent from saved notes in private chat
    Given a GM has a saved entry about the marsh crossing at <width> by <height>
    When the GM asks the Agent about the crossing in the private chat
    Then the reply cites the saved entry and stays in the private GM chat
    When no saved note is relevant
    Then the Agent explains that literal search found no relevant notes and semantic search is still indexing

    Examples:
      | layout  | width | height |
      | desktop | 1280  | 800    |
      | narrow  | 390   | 844    |

  Scenario Outline: E2E-08 — Format and paste within the allowlist
    Given a GM opens a new entry at <width> by <height>
    Then the toolbar offers only headings, lists, bold, italic, underline, strikethrough and clear formatting
    When the GM pastes rich text into the body
    Then paste keeps only supported text and formatting
    When the GM applies a heading, a bulleted list, bold text and clears formatting on a line
    And the GM creates the entry
    Then the drawer and results cards render the supported formatting without an editor toolbar

    Examples:
      | layout  | width | height |
      | desktop | 1280  | 800    |
      | narrow  | 390   | 844    |
