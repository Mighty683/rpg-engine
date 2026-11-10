# Character setup — UI solution

**Created:** 2026-11-05
**Related:** [Story](story.md) · [UX journey](ux.md) · [Technical design](tech.md)

## Prototype

The character setup prototype was an in-memory exploration and has been removed from the gallery. The shared character sheet is now available in the [production UI](../../../../packages/frontend/src/modules/characters/sheet/CharacterSheet.vue).

The sheet uses full-width cards: attributes and resources share one card; classes and skills occupy left and right sections of another; equipment and defense share a third. Sections stack on narrow screens. The sheet uses the supplied Fabula Ultima character sheet as a reference and retains the dark palette. It removes appearance, pronouns, identity/concept, origin and the starting-array selector at the user's direction; theme sits in the header. Attribute dice can be changed directly; the setup-issues summary has been removed. The rules specification still calls for identity and origin at creation; how those requirements are met remains open.

## Calculations and interaction

Maxima use the entered level, base MIG/WLP formula and known free benefits for Orator, Weaponmaster, Guardian and Rogue; IP starts at 6. Class cards accept free-text names and notes, with a maximum of two as requested for this prototype. The supplied rules allow two or three starting classes, so that prototype limit is a deliberate difference to resolve before implementation. These are partial maxima because skill and item effects are not available. Current HP, MP, IP and Fabula are editable. Before a current resource is manually edited it follows its partial maximum; after an edit it remains unchanged when the maximum changes. Changing the manual level preserves current HP and MP. Actual initialization and later resource changes need a production rule design.

Defense and magic defense start at DEX and INS; initiative starts at zero. The prototype applies explicitly configured bonuses from one equipped armor and one equipped shield, including fixed physical Defense and initiative modifiers. Entering a value overrides the calculation until **Use calculated** is selected. Other item and weapon effects are not automated. Skills use the same list interaction; ranks and effects are not validated. A real rules engine must handle fixed armor values, bonuses, equipment state and skill effects, rather than treating these partial values as final.

Optimistic interaction is a product direction: production must persist edits asynchronously, handle failed and unknown outcomes without silently losing input, and resolve concurrent changes. This prototype demonstrates instant local updates only. Loading, empty and error game-list states remain available through the gallery controls.

## Verification targets

The prototype build passed. The seeded character, creating a second character, switching the active character and the game overview were checked in the browser. At 804 × 684 and 375 × 812, the sheet was inspected and sample class benefits, edited HP, named equipment and skill details, manual defense, and a base-die update were exercised. The design-system gallery includes weapon and zenit icons and reusable d6, d8, d10 and d12 icons with square proportions; attribute selectors use the matching icon. Class entries use compact side-by-side cards; equipment and skill entries use the same reusable detail card with a popover editor, also demonstrated in the design-system gallery. Resource current and maximum values share an input-like frame, with only the current value editable. Touch sizes, keyboard navigation, cross-user behavior, failure recovery and full rules remain to be verified.
