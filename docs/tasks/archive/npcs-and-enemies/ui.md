# NPCs and enemies — UI design

**Created:** 2026-11-11  
**Status:** Approved as the production visual basis, adapted to optimistic updates.

## Review the prototype

Run `pnpm --filter @rpg-engine/frontend prototypes:dev` and open **Prototypes / NPCs and enemies / Game table with NPCs**. The [prototype guide](../../../../packages/frontend/prototypes/npcs-and-enemies/README.md) describes scenarios and reset behavior. Use the story's **View as** control to inspect GM and player views and **Table contents** for fixture states. No production backend is used.

For visibility review, switch **View as** to Player to see seeded visible and known examples of each relationship; hidden examples are absent. New NPCs default to Hidden and Neutral. Prototype data is local to the MSW session and resets on reload.

## Table and card

- Reuse the production table, side panels, party cards, roll controls, tokens and dark palette. NPC cards show saved name, level, attribute dice, HP/MP, defenses, expandable attacks and plain-text notes. Show no rank, separate accuracy label, visibility badge, tag or damage-affinity badge. Color name and border red for enemy, default for neutral and green for friend.
- Attack rows show name, reach, damage bonus/type and attribute dice; omit “high roll” text. The editor uses compact standard-size inputs, not oversized controls.
- GM sees full NPC cards, including notes, and can edit and roll. Player Known cards show stats and attacks but not GM notes. Visible cards show name and relationship color with `???` for stats and attacks; no level, attack details, notes, roll or edit controls. Hidden NPCs have no player card. Players have no NPC edge tab.
- NPC sheets and cards use the same saved NPC records; saving updates the card.

## NPC editor

Use character-sheet components for attribute dice, resource fields, defenses and level; retain NPC-specific data and rules instead of adding player-character-only fields. Name and level share the header, with an enemy/neutral/friend selector under the name. There is no rank field. The remaining panels contain visibility, attributes/resources, defenses, attacks and GM notes. Existing NPCs can be removed after confirmation.

Visibility is a GM-only select with Hidden, Visible and Known explanations; changes use optimistic updates without a general Save NPC button. Do not duplicate the visibility state as a card badge. Attack editor supports add, edit and remove; damage type is free text. Notes are a free-text field and render as text, not tags. Existing hidden fields remain in the mock record but are not UI features.

## Behavior, accessibility and focus

Use labelled controls, keyboard-operable buttons/selects and visible focus styles. Keep panel close and Escape behavior consistent with production. Disable affected fields while a request is pending. Use the existing optimistic UI and error feedback pattern. Do not add unsaved-change guards or draft preservation on navigation. A validation failure should remain actionable and follow the [UI conventions](../../../spec/ui.md), including submit availability and toast feedback; current prototype validation and inline error handling are not yet aligned. Do not expose GM notes in player views.

## Verification and implementation boundary

- Cover all three visibility levels, transitions and save/reopen; check that hidden NPCs have no player table or tab, visible NPCs expose only allowed information, and known NPCs show saved stats without GM notes.
- Cover GM create/edit/remove, attack add/edit/remove, player cards, card synchronization, pending and failed updates and optimistic behavior. Test keyboard focus and Escape/close flows.
- The shared mock API returns full NPC records to the browser regardless of role. Its role selector is only a visual preview; production must authorize and redact at the server boundary, including related endpoints and events, and test those guarantees independently.
- [Browser regression tests](../../../../packages/frontend/prototypes/npcs-and-enemies/GameTableWithNpcs.browser.ts) exercise the shared MSW flow. Run `pnpm exec vue-tsc --noEmit -p prototypes/tsconfig.json` from `packages/frontend`, the relevant browser tests, and `pnpm --filter @rpg-engine/frontend prototypes:build` before handoff. Actual build and test results should be recorded at handoff.

**2026-11-11 review:** Prototype build (including type-check) passed with Histoire setup and router warnings; the NPC browser suite passed all seven tests. This does not verify server-side authorization, production integration or optimistic updates.
