# Private rolls — UX journey

**Created:** 2026-11-12  
**Revised:** 2026-11-12

## Context

The [task](summary.md) covers rolls hidden from other game members. Today character, free and NPC rolls share throw history; NPC rolls are public even when the NPC is hidden, and can reveal its name, attack, dice, result or note. NPC visibility does not make its rolls private.

The user has specified that both players and the GM can make private rolls, and that the GM cannot see a player's private rolls. The remaining flow below is a proposed, untested design. The [GM persona](../../../research/personas/game-master.md) and related interviews are simulated, not evidence of real-user behavior. The [UX guidelines](../../../spec/ux.md) prioritize a single GM and defer broader player workflows; this task explicitly includes player privacy.

## Choose visibility and roll

1. A player or GM starts a character or free roll; the GM can also start an NPC roll. In either setup dialog, the user can select **Private roll** before submitting, including for opposed rolls.
2. When unchecked, the roll is visible to all game members. When checked, only the account that makes the roll can see it. This applies to the entire entry, including its existence, attribution, setup, note and result. The GM cannot see a player's private roll, and players cannot see the GM's private roll. Attribution to a character does not grant its controller access.
3. Proposed default: unchecked for new rolls, including NPC rolls, preserving current behavior. The choice applies to this roll only and is independent of NPC visibility. A hidden NPC's public roll can still reveal its details.
4. Confirming creates a history entry with its visibility indicated to its author. Canceling creates no entry. If submission cannot be confirmed, tell the user to check their history before trying again. Report API failures through an actionable toast and preserve the draft where creation is known to have failed.

## Read, reroll and remove

- Each member sees public rolls and their own private rolls in chronological history. Private rolls made by anyone else produce no entry, placeholder or visible notification. Existing rolls remain public. Empty history means no visible throws.
- Proposed reroll behavior: start with the source roll's visibility selected; the user can change it before submission. The new entry belongs to the account making the reroll and does not change the source. Making a reroll public can expose its copied setup and note.
- Removing a visible entry removes it for everyone who could see it. Existing author/GM removal permissions apply only to entries the requester may see; the GM cannot remove another person's private entry. Changing or revealing an existing entry is outside this proposed flow.
- Loading older entries, reconnecting and refreshing preserve the same visibility. On failure, use actionable error feedback and avoid displaying data the current account is no longer authorized to see.

## Where the experience changes

| Surface | Needed change |
| --- | --- |
| Character and NPC setup | `RollDialog.vue` needs a privacy checkbox for every applicable roll, including opposed rolls and rerolls. |
| Free roll setup | `FreeRollDialog.vue` needs the same checkbox for GM and player; privacy is independent of **Roll as**. |
| Table orchestration | `GameTable.vue` carries privacy through both drafts, submission and rerolls, and handles uncertain submissions. |
| Throw history | `HistoryPanel.vue`, `ThrowResultCard.vue` and `hooks.ts` show and paginate only visible entries; identify the author's private entries. |
| Shared data and live updates | Throw contracts, history retrieval, reroll and removal authorization, and game events need author-based privacy. Enforce access server-side for every response and operation; browser filtering is insufficient. Existing game-wide `throws` refresh hints must not reveal private activity to other members. Check caches and reconnects. |
| AI actions | Any future agent roll action must carry privacy and obey the same authorization rules; no agent roll interface is assumed to exist today. |

## Remaining assumptions

The public default, editable visibility on reroll and hiding the existence of private activity are proposed for implementation review; they have not been validated with users. See the [UI specification](ui.md) for controls and verification targets.
