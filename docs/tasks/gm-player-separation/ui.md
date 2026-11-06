# GM and player separation — UI solution

**Created:** 2026-11-06

**Status:** First prototype for review

The game opens to the character workspace. The header keeps the game, RPG system, current account, and role visible. Active characters have tabs, with the player's own characters listed first. Character creation and **Characters management** sit in a separate row above the tabs. The GM's **Settings** screen contains players and invitation links. A **Return to game** button returns from management or settings. See the [UX journey](ux.md).

## Screens and components

| Screen | First iteration |
| --- | --- |
| My games | Show each available game with its system and the account's role. Reuse the existing create-game prototype form. |
| Character overview | Show Nuxt UI tabs only for active characters, without an active badge. Place **Create character** and **Characters management** in a separate row that wraps when space is limited. Keep the actions available when there are no active tabs. Switching tabs opens the sheet in place and keeps edits in the prototype's local data. New GM-controlled characters start inactive. A player's first character becomes active if none is selected. |
| Character sheet | Render the shared Fabula Ultima sheet across the workspace. For characters outside the player's control, label the sheet **Read-only** and disable editing. The character tabs stay visible while switching sheets. |
| Characters management | Group all character cards, including inactive ones, in independently expandable sections for the GM and each player with assigned characters. Each header shows a character count. The current account's section appears first and opens by default. The GM can assign or take back any character. Update control is disabled until the selection changes, then uses the primary style. Each card has **Open sheet**. Use **Make active** or **Make inactive** on GM-controlled cards as the GM or on assigned cards as their player. An inactive card stays in management and its tab disappears from the main game screen. |
| Invitations | List the reusable game link and each character link with its own status and controls. In the same section, the GM can create a link for an unassigned character. Each link has independent copy, enable or disable, and rotate actions while unused. |
| Membership | Show who has game access. Confirm removal and explain that the characters stay in the game under GM control. Restoring access leaves character assignment separate. |
| Invitation acceptance | Resume the invitation after sign-in. A regular link prompts a new player to join and opens the roster for existing members. A character link names the character and offers **Make this character active**, selected by default. Unavailable links show a recovery path. |

Use the existing dark palette, Nuxt UI controls, and semantic spacing, surface, and typography tokens. Role, active state, access mode, and invitation status have text labels. The tab strip scrolls horizontally when space is limited, and the shared sheet uses its existing responsive layout.

Use labeled form controls, native button semantics, and visible keyboard focus. Move focus to the page heading when changing screens. Within the tab strip, left and right arrow keys switch sheets while focus stays on the selected tab. Use a modal for character creation and removal confirmation so keyboard focus stays within the task. Show validation next to the relevant field and confirm successful operations with a toast.

## Review the prototype

Run `pnpm --filter @rpg-engine/frontend prototypes:dev` and select **GM and player separation** in the gallery. The [prototype entry](../../../packages/frontend/prototypes/gm-player-separation/GameSeparationPrototype.vue) starts in **The Lantern Road** as Robin, its GM. Gallery controls above the application switch sample accounts and open sample invitations. The displayed URLs, sign-in, and data are simulated in memory. Reload the gallery to reset them.

1. As **Robin**, switch between character sheets and use **Characters management** to change who controls a character. Open **Settings** and disable one of the two Rowan Ash links to check that the other stays enabled. Review player removal and restoration in the same screen.
2. Switch to **Mira**. Compare Nera Vale's editable sheet with another character's read-only sheet. Create another character, then use **Characters management** to activate it. Return to the game and check that the new character replaces Nera in the tab strip.
3. As **Robin**, make Rowan Ash inactive and check that his tab disappears. Open his sheet from **Characters management** and activate him again from his card.
4. Switch to **Ellis** and choose the regular game link from **Open sample invitation** to preview joining without a character. Open an enabled Rowan Ash link to claim the character. To preview joining and claiming in one step, reload first and open the character link before the regular game link. After a claim, check that the used link is spent and the other unused link is blocked while Rowan has a player.
5. Review the roster and forms at phone width and with the keyboard. Check heading focus, modal focus, and status labels without relying on color.

The prototype covers the layout and local interactions. Production adds these flows:

- Sign-in and account creation use username and password fields. After either flow completes, resume a pending invitation or open **My games**.

Live link routing, remote saves and access recovery are integration work.
