# Character setup — UX journey

**Created:** 2026-11-04

## Evidence and current flow

The [story](story.md) establishes the GM's goal. The supplied Fabula Ultima PC specification describes the creation procedure and permits revisiting choices; the remaining rule data will be supplied in a later task. The [UX guidance](../../spec/ux.md) assumes a single GM and a multi-system product.

The current [games view](../../../packages/frontend/src/modules/games/GamesView.vue) lists games and creates one with a permanent system choice. It does not open a game; the [system catalog](../../../packages/backend/src/modules/rpg-systems/catalog.ts) currently contains Dungeons & Dragons 5e only. There is no player or character flow in the inspected frontend. The saved-game foundation is described in the [game creation task](../game-creation/summary.md). This journey proposes additions; it does not claim they exist.

## Journey and screens

```mermaid
flowchart TD
    A[Games list: create or open a game] --> B[Game creation: select Fabula Ultima]
    B --> C[Game: add a player]
    A --> C
    C --> D[Player: create or select a character]
    D --> E[Character setup: identity, theme, origin and presentation]
    E --> F[Classes and five skill ranks]
    F --> G[Starting attribute dice]
    G --> H[Starting equipment]
    H --> I[Review choices, derived stats and issues]
    I -->|Revise| E
    I -->|Complete| J[Character: view or edit sheet]
    I -->|Save draft| D
```

Setup can be revisited in any order. Show the game, player, draft status, remaining choices, and available calculations during setup. The system is fixed when the game is created. World and party references may be supplied when available but are not required.

## Recovery and boundaries

| Situation | Expected behavior |
| --- | --- |
| Draft is incomplete | Save it and show its save status. |
| Save fails | Keep entries and offer retry. |
| Save outcome is unknown | Let the GM check saved state before retrying. |
| A changed choice affects another | Show affected choices and preserve input while the GM resolves them. |
| A choice is missing or invalid | Show the issue at the relevant step and in review. |
| Character is completed | The GM can edit it later. |
| GM leaves with unsaved changes | Show the consequence and allow the GM to stay or discard. |
| Game uses another system | Do not start Fabula character setup. |

## Player and character rules

- A player has a name and belongs to one game; players are not reused across games.
- A player can own multiple characters, with at most one active at a time. A character belongs to one player.
- The GM can edit any character after creation, including inactive characters.
- Starting cash handling is deferred. Rule data will be supplied in a later task.
