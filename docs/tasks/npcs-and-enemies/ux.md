# NPCs and enemies — UX journey

**Created:** 2026-11-10
**Revised:** 2026-11-10 (aligned with the current prototype; focused on UX decisions and flows, not rendering)

## Context

The [user story](story.md) covers preparing and using NPCs and enemies during a session. The current prototype (`packages/frontend/prototypes/npcs-and-enemies/`) demonstrates the flows below. They reflect prototype review; none of them has been tested with a real GM. The [simulated GM interview](../../research/interviews/game-master-npcs-and-enemies.md) is invented, not evidence.

## Run the table with NPCs

**Goal:** during a session, the GM sees everyone in the scene at once and can act for NPCs.

- **Decision:** characters and NPCs live on the same table view, so the GM reads the whole scene in one place instead of switching views.
- **Decision:** the GM can filter the table to characters only or NPCs only, and the table has explicit empty, loading and error (with retry) states, so a sparse or failing table is never ambiguous.
- **Decision:** NPC attribute checks and attacks are rolled from the table with the same roll dialog as character weapons — one interaction pattern for all checks in a scene.
- **Decision:** NPC attacks use `+floor(level/10)` accuracy, per the rules, and attacks show their reach and damage information next to the roll action.
- **Decision:** the high-roll damage rule applies to both PC weapon attacks and NPC attacks — damage = high roll (higher of the two accuracy dice) + the attack's fixed damage bonus, per [weapon attacks](../../spec/fabula-ultima/weapon-attacks.md); accuracy modifiers are not added to the high roll, and a successful roll shows the computed damage in the throw result.
- **Decision:** a GM/Player view switch gates permissions: players cannot roll NPC dice, cannot add or edit NPCs, and see the character sheet read-only. A character's own roll permission is preserved regardless of role.
- Throw history and character sheets are reachable from the same side-panel entry point as the NPC editor, so all session tools sit in one place.

## Tag NPCs and characters

**Goal:** the GM organizes scene actors with memorable labels without leaving the creation flow.

- **Decision:** tags are free-form text with autocomplete — previously used tags are suggested while typing and can be picked or newly created on confirm.
- **Decision:** the tag list is per game, so tags carry over between NPCs and characters; tags can be attached to both NPCs and party characters.
- **Decision:** each tag carries a color from a fixed palette; reusing a saved tag keeps its color, a new tag gets the chosen color. (Open question: is color meaningful to users, or should tags be single-color?)
- **Decision:** tags are not restricted to the eight Fabula Ultima types; the prototype NPC no longer exposes a separate type field.

## Create and edit NPCs

**Goal:** the GM prepares an NPC before or during a session with minimal friction.

- **Flow:** "+ Add NPC" starts a new NPC; the edit action on an existing NPC card opens that NPC for editing. Both open the NPC editor panel with one tab per NPC plus a "+ New NPC" tab.
- **Decision:** editing happens in the side panel, not on the card and not on a separate page, so the GM keeps the table in view while editing.
- **Decision:** the NPC editor mirrors the character sheet layout — same sheet header (kicker, name, read-only level mark) and `SheetSection` panels — and collects only editable fields: name (required — saving is blocked until it is set), rank (Soldier / Elite / Champion), tags and notes. Role, traits, type and level are not editable in the prototype.
- **Decision:** saving an NPC also saves any new tags it introduced into the game's tag list.
- **Open question (untested):** the side-panel editor is the prototype's resolution; drawer vs. separate view vs. inline editing in production remains unresolved.

## Inspect attacks and abilities without leaving the table

**Goal:** the GM can check what an NPC can do mid-scene without losing table context.

- **Decision:** attacks and abilities are collapsed by default on the NPC card so the table stays scannable; expanding reveals the full list.
- **Decision:** each attack is directly rollable from the expanded list, with its damage information visible beside the roll action.
- **Decision:** a preview of the collapsed entries is available on hover/focus, so the GM can peek at attacks or abilities without expanding and reflowing the card.

## View the detailed NPC profile

**Goal:** the GM can review an NPC's complete stat block — attacks, abilities, affinities, notes — in one place.

- **Decision:** the detailed NPC profile is a standalone full view (prototype: the NPC card story), separate from the compact table card.
- **Open question (untested):** in the table flow, editing is reached via the card's edit action opening the side panel — not by clicking the card body.

## Scope and handoff

The prototype uses local fixture data and local state; none of these flows is wired to production persistence. Production still needs to define tag persistence per game, whether tags are shared with players, and how NPC visibility to players works during a session. Adding the damage bonus to production weapons (schema, validation, party payload, roll resolution showing high roll + bonus damage on a hit) is specified but not implemented; the shared high-roll rule is in [weapon attacks](../../spec/fabula-ultima/weapon-attacks.md).
