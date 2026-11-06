# Game Table — UX journey

**Created:** 2026-11-06

## Context

The [simulated GM review](../../research/interviews/game-master-application-review.md) found that the GM had to switch sheets to see the party’s resources. The Game Table brings those summaries and rolls together. The workflow below reflects prototype review. Its usefulness during a live session has yet to be tested.

## Run the table

- Open the Game Table to see the game name, role, active party and throw history. The GM can open **Settings** and return to the table.
- Scan each character card for name, classes, attribute dice, current and maximum HP, MP and IP, Fabula Points, Defense, Magic Defense and weapons. A character at zero HP has a **0 HP** badge. The compact cards omit the controller hint and Crisis badge.
- Open **Character sheets** from the right-edge bookmark. Switch sheets with tabs. The sheet identifies the controller above the name. Click the bookmark again to close the drawer and return to the table.

## Choose and configure a roll

| Starting point | Setup |
| --- | --- |
| Attribute die on a party card | Start with that attribute. Optionally add or clear a second attribute. Change die sizes for temporary effects and enter a check modifier and optional note. Choosing the same attribute twice uses one die size and two independent rolls. A single die is recorded as an attribute roll. |
| Weapon on a party card | Review the weapon’s configured pair of attributes and saved accuracy bonus. Adjust the die sizes and add a signed check modifier and optional note. A weapon with incomplete accuracy data directs the user to its sheet. The result shows accuracy for the GM to compare with the target’s Defense. |
| **Make a roll** in Throw history | Start with an empty pool. Click a die to add it and click a pooled die to remove it. A free roll accepts one or two friendly dice. The GM can roll as GM or choose any active character in the game, including one controlled by a player. The player rolls as their active character, which is recorded at submission. |
| **Reroll** in Throw history | Reopen the appropriate setup with the previous dice, modifiers, opposing dice and note. Review or edit the draft before submitting a new roll. For a free reroll, the GM can keep the original character if still active, choose another active character, or roll as GM. |

For an opposed check, add two red opposing dice and, if applicable, an opposing modifier. The free roller shows both colors in a single removable pool. Each side uses two attribute dice for a Fabula opposed check. When starting from a character’s attributes, the opposing dice follow the friendly attribute order. The prototype also permits a single friendly attribute die against two opposing dice and records that as a generic opposed roll compared by total. That is outside Fabula’s check rules.

Click **Roll** to confirm. Canceling leaves history intact. Temporary choices apply to the throw and do not change the character sheet.

## Read and revisit the result

- New results append at the bottom. The list scrolls to the latest entry and highlights it briefly. The entry shows roll attribution, die faces, nonzero modifiers, total or accuracy, any critical or fumble, and the optional note.
- An opposed result shows the friendly and opposing dice side by side, with both totals and the outcome on one line. A tie can be rerolled from history.
- **Reroll** creates a separate history entry on confirmation. It is a table convenience and does not implement spending Fabula Points, invoking Traits or replacing an official check result. The **×** removes an individual entry.

## Scope and handoff

The prototype uses seeded data and in-memory history. It previews GM and player attribution through a gallery control. Production still needs to define live roster and sheet permissions, durable or shared history, and handling of changes to active characters while a roll is open. The current prototype still limits GM free rolls to GM-controlled characters and matches free reroll attribution by name. The agreed flow uses all active characters for GM selection and stable character IDs for attribution.

The table does not resolve attacks against a target, apply damage or change resources automatically. Fixed-Difficulty adjudication, support and group checks, and Fabula Point spending remain outside the reviewed flow. See [Fabula Ultima checks](../../spec/fabula-ultima/checks.md) and [weapon attacks](../../spec/fabula-ultima/weapon-attacks.md).
