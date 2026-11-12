# NPCs and enemies — UX journey

**Created:** 2026-11-10  
**Revised:** 2026-11-11

## Context

The [user story](story.md) covers preparing and using NPCs during a session. This journey records the user's prototype-review decisions, not research validation. The [GM interview](../../../research/interviews/game-master-npcs-and-enemies.md) is simulated, not evidence of real-user behavior. Player views are being explored for this task even though broader player workflows remain deferred in the [UX guidelines](../../../spec/ux.md).

## Prepare and edit an NPC

The GM opens **NPCs** and selects **+ New NPC**, or uses the edit action on an existing card. The side panel retains the table context and follows the character-sheet interaction and component style while using NPC-specific fields.

- Edit name, relationship (enemy, neutral, friend), level, attribute dice, HP and MP, physical and magic defense, attacks and free-text GM notes. NPCs do not have a rank field.
- Add, edit or remove attacks, including reach, two attributes, damage bonus and free-text damage type. Attack information is shown without redundant “high roll” wording.
- Apply edits using the existing optimistic UI pattern; there is no general Save NPC button. Adding an attack may use a separate add action. Stats are manual and do not recalculate when other fields change.
- Tags, structured abilities, damage-affinity badges, crisis and initiative are outside this iteration. Notes are ordinary text, not tags. Previously seeded fields are retained in the prototype data but not displayed or edited.
- Closing the panel or switching NPCs does not require an unsaved-changes guard or draft preservation.

## Run the table

Characters and NPCs appear together. NPC cards show the same saved name, level, dice, HP, MP, defenses, attacks and notes as their editor; relationship determines name and border color. There is no extra accuracy or visibility badge. The GM can roll NPC attributes and expand attacks to roll them. The prototype's NPC attack roll retains the rules-based level accuracy modifier; hiding its card label does not remove that modifier. High-roll damage remains a rules calculation, not a separate damage mode. See [NPC rules](../../../spec/fabula-ultima/npcs-and-enemies.md) and [weapon attacks](../../../spec/fabula-ultima/weapon-attacks.md).

The gallery offers mixed, character-only, NPC-only, empty, loading and error review states. These are review controls, not an implemented production filtering feature. The GM can reach character sheets and throw history through the table panels. Players cannot edit NPCs or roll NPC actions in the prototype.

## Control what players see

The GM changes player visibility in the NPC editor using the same optimistic update pattern. New NPCs default to **Hidden**. Existing prototype fixtures without a visibility setting are treated as **Known** to preserve the existing review experience.

| Setting | Player table and NPC panel                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Hidden  | No card or NPC tab; the NPC is not visible.                                                                                                |
| Visible | Name and relationship are visible; level, attributes, resources, defenses and attacks are concealed with `???`. |
| Known   | Card shows stats and attacks. GM notes remain private. |

The GM sees the full card regardless of setting and checks or changes visibility in the editor, not via a card badge. NPC rolls and their snapshots are public to game members, even when the NPC is hidden; GM notes remain private. Players have no NPC edge tab. The role selector in Histoire previews these states; it is not an actual multi-user session. Visibility is a product decision under review, not evidence that players can safely access prototype endpoints.

## Handoff and open questions

- The prototype uses shared MSW handlers and in-memory persistence, not production NPC storage or real-time collaboration. The mock API sends full records to both role previews; production must enforce authorization, filtering and redaction server-side for lists, detail endpoints, events and related data. Client-side hiding is not security.
- Use the existing optimistic update pattern and actionable error feedback; do not add unsaved-change guards.
- Decide how visibility changes reach connected players, including revocation of previously known information. A player who already saw information cannot be made to forget it.
- The high-roll damage calculation and authoritative NPC roll integration are not implemented by this prototype. Avoid treating its free-roll fixture as production combat automation.
