# Fabula Ultima — defense and equipment

## Ordinary defense calculation

Without equipment, physical Defense uses the current DEX die size, Magic Defense uses the current INS die size, and the Initiative modifier starts at zero. Ordinary armor can add to DEX-based Defense or replace its physical base with a fixed Defense; apply a shield's Defense bonus after resolving the armor base. Add ordinary armor and shield Magic Defense bonuses to current INS, and apply applicable initiative modifiers. Negative initiative modifiers are valid.

For example, DEX d8 and INS d10 with traveler garb (+1 to each defense, −1 initiative) and a runic shield (+2 to each defense) give Defense 11, Magic Defense 13 and Initiative −1. These are representative fixtures, not a complete item catalog.

Only equipped items contribute equipped effects. Normally a character can equip one armor and one shield; the shield occupies a hand. Martial armor and shields require their respective martial entitlements. Hand use, eligibility, and effects from skills or exceptional items can override the ordinary path; resolve those rules explicitly rather than forcing every effect into an additive formula. Temporary die changes can affect defenses based on current dice; they do not change maximum HP or MP calculated from base dice.

## Implementation boundary

Keep equipped-item selections and sourced effects separate from derived Defense, Magic Defense and Initiative. Recalculate when applicable attributes, equipment or effects change. Unknown item or skill effects must not be represented as known zero effects or presented as a complete result. A manually entered override must remain distinguishable from the calculated value and be reversible.

Source: [supplied Fabula Ultima character specification](../../tasks/character-setup/fabula-ultima-character-spec.md), §§3–5 and 11.
