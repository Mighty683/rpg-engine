# Class management — UI solution

**Created:** 2026-11-12

This is an unapproved layout iteration of the [UX journey](ux.md). Review **Prototypes / Class management** in the Histoire gallery. The [story](../../../packages/frontend/prototypes/class-management/ClassManagement.story.vue) exposes screen and context controls; the shared [view](../../../packages/frontend/src/modules/class-management/ClassManagementPreview.vue) renders both contexts. Example content is illustrative, not preinstalled catalog data.

## Screens and navigation

| Screen                    | Entry and next steps                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Class library             | Open Classes outside a game. Browse classes, create one or open one to edit. Identify its system and explain that game copies stay independent.                                                                                                   |
| Game classes              | From a game, open Classes. Use the same list and editor as the library, labeled with the game name. Open an existing game copy or choose Copy from library.                                                                                       |
| Class details             | Select View class to review and edit class details and free benefits on the same screen. Back to classes returns to the list.                                                                                                                     |
| Create class              | Select Create class to see the empty class form and its benefit and skill sections. Back to classes returns to the list.                                                                                                                          |
| Copy from library         | Open from game classes; browse compatible library entries, review and copy one into the named game. Return to game classes or open the new copy.                                                                                                  |
| Remove skill confirmation | Open from a game class editor when the skill is used. List affected characters and explain removal from each; cancel returns to editing, confirmation removes the skill.                                                                          |
| Character benefits        | Reach from a character sheet after using a game class. Show each benefit's source and whether it is text or a stat modifier, with the resulting stat value for applied modifiers. Character selection and rank progression remain to be designed. |

## Design and behavior

Use the existing dark palette, semantic tokens and Nuxt UI components. Benefit entries use compact, bordered cards; short controls share a row when space permits and use the standard medium input size and input-label spacing token. The library and game screens share composition and controls; context labels and the copy action distinguish their scope. Skill and benefit entries have clear text or stat-modifier labels. Class and skill editing, validation, and save states are subject to the same design in both contexts.

The list links to class details and creation. Class details is also the editing screen; there is no separate editor. Back to classes returns to the list. The gallery controls also switch screens and contexts. The creation screen allows adding and removing draft free benefits, choosing a text effect or stat modifier, and entering its fields. Draft benefits remain while switching screens or contexts and reset on reload; they are not saved. Class name, description and free benefits on the details screen are editable drafts, separate for library and game contexts. They remain while switching screens and reset on reload. The list shows the original example until saving is designed. Saving, adding skills, copying and skill removal are not implemented. Modifier targets include maximum HP, MP and IP, Defense, Magic Defense, and attribute dice. Attribute changes use signed die steps bounded by d6 and d12. The distinction between base and current attribute dice still needs a rules decision for each effect; automatic application is not implemented. The system is shown in context rather than selected in a form while Fabula Ultima is the only system. It does not connect to a backend or claim to demonstrate persistence, error handling or actual rules. The details screen samples one skill; detailed skill forms are not yet designed. The character sample's numbers are illustrative, not a rules calculation. A library context selected with the game-only copy, removal or character screen is a gallery combination, not a proposed route.

For implementation, use a focused confirmation dialog that moves focus inside on open and returns it to the initiating control on cancellation; retain input on errors, warn before discarding unsaved edits, disable inputs while saving, and report API failures via toast. Validate labels and keyboard navigation with the production components. The skill-removal warning must name all affected characters and state the consequence before confirmation.

## Persona review iteration

The [simulated GM and player reviews](../../research/interviews/class-management/README.md) prompted clearer context, copy and removal wording, and an explanation of applied versus text benefits. The revised static markup received a second desk review; neither iteration was tested with participants. Detailed forms, skill-sourced benefits and interactive recovery remain open.

## Verification targets

Review both contexts at desktop and narrow widths; confirm identical class and skill editing, clear scope labels, empty and loading states, and the route back from each screen. Later interactive work must verify saving, copy independence, edit/display synchronization, affected-character removal, failure recovery, and focus behavior. The existing manual character entries require a separate conversion decision. This layout has not been user-tested or approved.
