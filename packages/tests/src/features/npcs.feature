Feature: NPCs at the game table

  Scenario: The GM makes a free roll as an NPC
    Given the GM has an NPC game open
    When the GM creates an NPC named "Oracle"
    And the GM makes a free roll as NPC "Oracle"
    Then the NPC free roll is attributed to "Oracle"

  Scenario: The GM creates and reopens an NPC
    Given the GM has an NPC game open
    When the GM creates an NPC named "Goblin"
    Then the NPC card shows "Goblin"
    When the GM sets NPC "Goblin" level to 12 and notes to "Ambushes the party"
    Then NPC "Goblin" card shows level 12 and notes "Ambushes the party"
    When the GM sets NPC "Goblin" stats
    When the GM adds an NPC attack named "Slash"
    Then the NPC attack "Slash" appears on the card
    When the GM rolls and rerolls the NPC attack "Slash"
    Then the NPC history contains two rolls
    When the GM reloads the NPC game
    Then the NPC card shows "Goblin"
    And NPC "Goblin" card shows level 12 and notes "Ambushes the party"
    And NPC "Goblin" shows the saved stats
    And the NPC attack "Slash" appears on the card
    When the GM changes NPC "Goblin" attack "Slash" to "Thrust"
    Then the NPC attack "Thrust" appears on the card
    When the GM removes NPC "Goblin" attack "Thrust"
    Then NPC "Goblin" card no longer shows the attack "Thrust"
    When the GM removes the NPC "Goblin"
    Then the NPC card no longer shows "Goblin"

  Scenario: Players receive visibility changes and public NPC rolls
    Given the GM and player have an NPC game open
    When the GM creates an NPC named "Bandit"
    And the GM sets NPC "Bandit" level to 12 and notes to "A private secret"
    Then the player sees no NPC named "Bandit"
    When the GM changes the NPC visibility to "visible"
    Then the player sees a concealed NPC named "Bandit"
    When the GM changes the NPC visibility to "known"
    Then the player sees the known NPC named "Bandit"
    When the GM adds an NPC attack named "Claw"
    Then the NPC attack "Claw" appears on the card
    When the GM rolls and rerolls the NPC attack "Claw"
    And the GM rolls the NPC's DEX
    Then the player sees 3 NPC rolls in history
    When the player loses connection
    When the GM changes the NPC visibility to "hidden"
    And the player reconnects and returns to the game
    Then the player sees no NPC named "Bandit"

  Scenario: A failed NPC edit reconciles and closes with the keyboard
    Given the GM has an NPC game open
    When the GM creates an NPC named "Guard"
    And an NPC update fails after the GM changes its name
    Then the NPC editor shows the saved name "Guard"
    When the GM closes the NPC editor with Escape
    Then focus returns to the NPC edit control

  Scenario: The GM edits an NPC using the keyboard
    Given the GM has an NPC game open
    When the GM creates an NPC named "Mage"
    And the GM edits the NPC name to "Wizard" using the keyboard
    Then the NPC card shows "Wizard"
    When the GM closes the NPC editor with Escape
    Then focus returns to the NPC edit control

  Scenario: The NPC editor shows a pending update
    Given the GM has an NPC game open
    When the GM creates an NPC named "Priest"
    Then the NPC editor shows progress and blocks fields during an update

  Scenario: The NPC list loads without moving the table
    Given the GM signs in to an NPC game
    When the GM opens the game while the NPC list is loading
    Then the table shows an NPC loading indicator
