# NPCs and enemies — UX journey

**Created:** 2026-11-10  
**Revised:** 2026-11-11

## Context

The [user story](story.md) covers preparing and using NPCs during a session. This journey records the user's prototype-review decisions, not research validation. The [GM interview](../../research/interviews/game-master-npcs-and-enemies.md) is simulated, not evidence of real-user behavior. Player views are being explored for this task even though broader player workflows remain deferred in the [UX guidelines](../../spec/ux.md).

## Prepare and edit an NPC

The GM opens **NPCs** and selects **+ New NPC**, or uses the edit action on an existing card. The side panel retains the table context and follows the character-sheet interaction and component style while using NPC-specific fields.

- Edit name, rank (Soldier, Elite, Champion), level, attribute dice, HP and MP, physical and magic defense, attacks and free-text GM notes. Rank appears beside the name; no rank multiplier is shown.
- Add, edit or remove attacks, including reach, two attributes, damage bonus and free-text damage type. Attack information is shown without redundant “high roll” wording.
- Save explicitly to update the NPC card. The prototype keeps a local draft until save; saving failures retain it. Stats are currently manual and do not recalculate when other fields change.
- Tags, structured abilities, damage-affinity badges, crisis and initiative are outside this iteration. Notes are ordinary text, not tags. Previously seeded fields are retained in the prototype data but not displayed or edited.
- Closing the panel or switching NPCs can currently discard unsaved edits. Preventing accidental draft loss is required before implementation; the exact confirmation or draft-preservation interaction remains to be decided.

## Run the table

Characters and NPCs appear together. NPC cards show the same saved name, rank, level, dice, HP, MP, defenses, attacks and notes as their editor; there is no extra accuracy or visibility badge. The GM can roll NPC attributes and expand attacks to roll them. The prototype's NPC attack roll retains the rules-based level accuracy modifier; hiding its card label does not remove that modifier. High-roll damage remains a rules calculation, not a separate damage mode. See [NPC rules](../../spec/fabula-ultima/npcs-and-enemies.md) and [weapon attacks](../../spec/fabula-ultima/weapon-attacks.md).

The gallery offers mixed, character-only, NPC-only, empty, loading and error review states. These are review controls, not an implemented production filtering feature. The GM can reach character sheets and throw history through the table panels. Players cannot edit NPCs or roll NPC actions in the prototype.

## Control what players see

The GM selects player visibility in the NPC editor and saves the NPC to apply it. New NPCs default to **Hidden**. Existing prototype fixtures without a visibility setting are treated as **Known** to preserve the existing review experience.

| Setting | Player table and NPC panel                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Hidden  | No card or NPC tab; the NPC is not visible.                                                                                                |
| Visible | Name and rank are visible; level, attributes, resources, defenses and attacks are concealed with `???`. The detailed sheet is unavailable. |
| Known   | Card and read-only sheet show stats and attacks. GM notes remain private.                                                                  |

The GM sees the full card regardless of setting and checks or changes visibility in the editor, not via a card badge. The role selector in Histoire previews these states; it is not an actual multi-user session. Visibility is a product decision under review, not evidence that players can safely access prototype endpoints.

## Handoff and open questions

- The prototype uses shared MSW handlers and in-memory persistence, not production NPC storage or real-time collaboration. The mock API sends full records to both role previews; production must enforce authorization, filtering and redaction server-side for lists, detail endpoints, events and related data. Client-side hiding is not security.
- Preserve drafts on failure and prevent loss on tab/panel changes; resolve the interaction before implementation.
- Decide how visibility changes reach connected players, including revocation of previously known information. A player who already saw information cannot be made to forget it.
- The high-roll damage calculation and authoritative NPC roll integration are not implemented by this prototype. Avoid treating its free-roll fixture as production combat automation.
