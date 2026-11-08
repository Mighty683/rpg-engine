# Game Table — UI prototype

**Created:** 2026-11-06

The [Game Table UX journey](ux.md) describes the full roll workflow. The prototype uses the existing dark palette, semantic tokens, Nuxt UI controls and the shared character sheet.

| Area | Reviewed design |
| --- | --- |
| Gallery header | **Preview role** in the Histoire Controls panel drives the GM and player previews. |
| Game header | Show the game name, system and role. **Settings** is available in the GM preview and leads to sample player and invitation controls with **Return to game**. |
| Active party | Compact character cards show class names close beneath the character name. A row of clickable attribute dice sits above the stat tiles. Read-only stat values stay bottom-aligned without stretching and use the default cursor. Weapon cards show their configured attribute dice and names. Clicking the whole card opens roll setup. |
| Character sheets | A right-edge bookmark opens a tabbed drawer over the table. The same bookmark closes it. Controller text sits in small type above the name field. The level field omits the manual hint. |
| Throw history | Use a two-column grid at desktop widths with the history panel matching the party panel’s height. Scroll within the history while keeping its header and **Make a roll** action visible. Stack the panels at narrower widths and cap the history list’s height. Start at the bottom and scroll there on each new throw. Apply a one-second highlight and subtle bounce. Respect reduced-motion preferences. |
| Roll entry | Show **Reroll** beside the removal icon. In the dice line, place the small attribute label above the die icon and show its face in a hexagon. Omit zero modifiers and emphasize nonzero ones. Keep red opposing dice beside the friendly dice, separated by “vs”, with both totals and the outcome on one line where space permits. |
| Character and weapon dialogs | Put the character and roll name in the title and the temporary-effects guidance in the header. Present die sizes as icon choices and the check modifier alongside the main die row. Attribute rolls have optional second-attribute buttons below that row, followed by a die selector when a different attribute is chosen. Show the saved weapon bonus separately. Put the optional Note field near the footer. |
| Free-roll dialog | Show **Roll as** for the GM with GM and every active character in the game, including player-controlled characters. In the player preview, display the active character. Below that, show friendly dice, opposing dice, the combined pool and optional note. Each dice row has a matching modifier card with a centered value. |

The current gallery prototype still filters the GM’s **Roll as** list to GM-controlled characters. The table above reflects the updated design.

The dice controls use buttons or radio groups with visible selected and focus states. Give icon-only actions descriptive names. Pool dice are removable with a click or keyboard activation. When a side reaches two dice, disabled dice expose **Maximum 2 dice** on hover or focus. Keep roll validation actionable inside the dialog. The history announces changes politely and its scroll region is keyboard focusable. Use labels, “vs” and outcome text alongside red and green dice to distinguish the two sides.

The [Game Table prototype](../../../packages/frontend/prototypes/game-table/GameTablePrototype.vue) owns preview state and roll history. [PartyOverview](../../../packages/frontend/prototypes/game-table/PartyOverview.vue) presents character cards, [OpposedSetup](../../../packages/frontend/prototypes/game-table/OpposedSetup.vue) presents opposing dice and modifiers, and [the comparison logic](../../../packages/frontend/prototypes/game-table/opposed.ts) resolves the two sides.

Run `pnpm --filter @rpg-engine/frontend prototypes:dev` and select **Prototypes / Game Table**, and use its Controls panel to select the role. Check both role previews, a single-die attribute roll, a weapon roll, a two-sided roll and the seeded tie. Verify that reroll opens an editable setup and only confirmation adds a history entry. Confirm that drawer and settings navigation return to the table, and that the history scrolls independently on desktop and fits when stacked.
