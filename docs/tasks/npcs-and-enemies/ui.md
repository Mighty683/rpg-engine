# NPCs and enemies — UI design

**Created:** 2026-11-11  
**Status:** Iterating; prototype review decisions, not production implementation.

## Review the prototype

Run `pnpm --filter @rpg-engine/frontend prototypes:dev` and open **Prototypes / NPCs and enemies / Game table with NPCs**. The [prototype guide](../../../packages/frontend/prototypes/npcs-and-enemies/README.md) describes scenarios and reset behavior. Use the story's **View as** control to inspect GM and player views and **Table contents** for fixture states. No production backend is used.

For visibility review, open a card's edit action, select a visibility level, save, close the panel and switch **View as** to Player. New NPCs default to Hidden; existing sample NPCs default to Known. Prototype data is local to the MSW session and resets on reload.

## Table and card

- Reuse the production table, side panels, party cards, roll controls, tokens and dark palette. NPC cards show saved name, rank, level, attribute dice, HP/MP, defenses, expandable attacks and plain-text notes. Show no rank multiplier, separate accuracy label, visibility badge, tag or damage-affinity badge.
- Attack rows show name, reach, damage bonus/type and attribute dice; omit “high roll” text. The editor uses compact standard-size inputs, not oversized controls.
- GM sees full NPC cards, including notes, and can edit and roll. Player Known cards show stats and attacks but not GM notes. Visible cards show only name and rank with `???` for stats and attacks; no level, attack details, notes, roll or edit controls. Hidden NPCs have no player card or tab.
- NPC sheets and cards use the same saved NPC records; saving updates the card. A player selecting a Visible NPC sees a short redaction message instead of the sheet; a Known NPC has a read-only sheet without GM notes. An empty player NPC panel explains that no NPCs are visible.

## NPC editor

Use character-sheet components for attribute dice, resource fields, defenses and level; retain NPC-specific data and rules instead of adding player-character-only fields. Name, rank and level share the header; rank remains Soldier, Elite or Champion. The remaining panels contain visibility, attributes/resources, defenses, attacks and GM notes.

Visibility is a GM-only select with Hidden, Visible and Known explanations; changes apply on **Save NPC**. Do not duplicate the visibility state as a card badge. Attack editor supports add, edit and remove; damage type is free text. Notes are a free-text field and render as text, not tags. Existing hidden fields remain in the mock record but are not UI features.

## Behavior, accessibility and focus

Use labelled controls, keyboard-operable buttons/selects and visible focus styles. Keep panel close and Escape behavior consistent with production. Disable affected fields while a request is pending. Preserve draft input on failure. Production must guard unsaved edits on NPC selection or panel close; the current prototype does not. A validation failure should remain actionable and follow the [UI conventions](../../spec/ui.md), including submit availability and toast feedback; current prototype validation and inline error handling are not yet aligned. Do not expose GM notes in player views.

## Verification and implementation boundary

- Cover all three visibility levels, transitions and save/reopen; check that hidden NPCs have no player table or tab, visible NPCs expose only allowed information, and known NPCs show saved stats without GM notes.
- Cover GM create/edit, attack add/edit/remove, read-only player states, card synchronization, pending and failed saves, draft preservation and navigation guards. Test keyboard focus and Escape/close flows.
- The shared mock API returns full NPC records to the browser regardless of role. Its role selector is only a visual preview; production must authorize and redact at the server boundary, including related endpoints and events, and test those guarantees independently.
- [Browser regression tests](../../../packages/frontend/prototypes/npcs-and-enemies/GameTableWithNpcs.browser.ts) exercise the shared MSW flow. Run `pnpm exec vue-tsc --noEmit -p prototypes/tsconfig.json` from `packages/frontend`, the relevant browser tests, and `pnpm --filter @rpg-engine/frontend prototypes:build` before handoff. Actual build and test results should be recorded at handoff.

**2026-11-11 review:** Prototype build (including type-check) passed with Histoire setup and router warnings; the NPC browser suite passed all seven tests. This does not verify server-side authorization, production integration or unsaved-draft guards.
