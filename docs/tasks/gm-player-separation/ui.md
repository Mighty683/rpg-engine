# GM and player separation — UI solution

**Created:** 2026-11-06

**Status:** First prototype for review

The game opens to the character workspace. The header keeps the game, RPG system, current account, and role visible. Active characters have tabs, with the player's own characters listed first. The tab bar also provides character creation and **Characters management**. The GM's **Settings** screen contains players and invitation links. A **Return to game** button returns from management or settings. See the [UX journey](ux.md).

## Screens and components

| Screen | First iteration |
| --- | --- |
| My games | Show each available game with its system and the account's role. Reuse the existing create-game prototype form. |
| Character overview | Show Nuxt UI tabs only for active characters, without an active badge. Place the highlighted **Create character** action and secondary copy action inside the tab bar, with **Characters management** on the right. Switching tabs opens the sheet in place and keeps edits in the prototype's local data. The prototype treats GM-controlled characters as active. A player can create a character or copy one from a compatible game. Their first character becomes active if none is selected; otherwise use character management to activate a new character. |
| Character sheet | Render the shared Fabula Ultima sheet across the workspace. For characters outside the player's control, label the sheet **Read-only** and disable editing. The character tabs stay visible while switching sheets. |
| Characters management | Show all characters, including inactive characters, as tiles with their controller and active status. The GM can assign or take back any character. Update control is disabled until the selection changes, then uses the primary style. Players can activate their own characters. |
| Invitations | List the reusable game link and each character link with its own status and controls. In the same section, the GM can create a link for an unassigned character. Each link has independent copy, enable or disable, and rotate actions while unused. |
| Membership | Show who has game access. Confirm removal and explain that the characters stay in the game under GM control. Restoring access leaves character assignment separate. |
| Invitation acceptance | Resume the invitation after sign-in. A regular link prompts a new player to join and opens the roster for existing members. A character link names the character and offers **Make this character active**, selected by default. Unavailable links show a recovery path. |

Use the existing dark palette, Nuxt UI controls, and semantic spacing, surface, and typography tokens. Role, active state, access mode, and invitation status have text labels. The tab strip scrolls horizontally when space is limited, and the shared sheet uses its existing responsive layout.

Use labeled form controls, native button semantics, and visible keyboard focus. Move focus to the page heading when changing screens. Within the tab strip, left and right arrow keys switch sheets while focus stays on the selected tab. Use a modal for create, copy, and removal confirmation so keyboard focus stays within the task. Show validation next to the relevant field and confirm successful operations with a toast.

## Review the prototype

Run `pnpm --filter @rpg-engine/frontend prototypes:dev` and select **GM and player separation** in the gallery. The [prototype entry](../../../packages/frontend/prototypes/gm-player-separation/GameSeparationPrototype.vue) starts in **The Lantern Road** as Robin, its GM. Gallery controls above the application switch sample accounts and open sample invitations. The displayed URLs, sign-in, and data are simulated in memory. Reload the gallery to reset them.

1. As **Robin**, switch between character sheets and use **Characters management** to change who controls a character. Open **Settings** and disable one of the two Rowan Ash links to check that the other stays enabled. Review player removal and restoration in the same screen.
2. Switch to **Mira**. Compare Nera Vale's editable sheet with another character's read-only sheet. Copy Lio Finch from Sky Harbor, then use **Characters management** to activate the copy. Return to the game and check that Lio replaces Nera in the tab strip.
3. Switch to **Ellis** and choose the regular game link from **Open sample invitation** to preview joining without a character. Open an enabled Rowan Ash link to claim the character. To preview joining and claiming in one step, reload first and open the character link before the regular game link. After a claim, check that the used link is spent and the other unused link is blocked while Rowan has a player.
4. Review the roster and forms at phone width and with the keyboard. Check heading focus, modal focus, and status labels without relying on color.

The prototype covers the layout and local interactions. Access to inactive character sheets needs a separate design. Authentication, live link routing, and remote save and access recovery are integration work.
