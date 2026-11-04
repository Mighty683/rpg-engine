# Game master (MG) — provisional persona

**Status:** Simulated, not based on participant interviews. Created 2026-11-04.

## Role and goals

The game master runs a tabletop RPG session and needs to manage the game while keeping it moving for the players. The product intends to support multiple RPG systems and give the MG management authority across the game; players are limited to their personal scope ([UX guidelines](../../spec/ux.md)).

## Working assumptions to validate

- **Context:** The MG alternates between directing the session and operating the application, potentially under time pressure.
- **Behavior:** They may need to switch quickly between a session overview and individual game elements without losing their place.
- **Needs:** Immediate access to relevant session information and actions, clear feedback on changes, and a way to recover from mistakes. The interface should make the scope of MG actions clear.
- **Likely friction:** Finding an action during play, navigating away from the current situation, uncertainty about what changed or who can see it, and accidental changes to shared game state.
- **Experience:** Familiarity with a particular RPG system or digital tools is unknown; neither expertise nor inexperience should be assumed.

These are hypotheses for evaluating and designing the product, not observed user behavior or proof of demand. The guideline that necessary game information should remain visible is a product intention, not evidence that every control must be visible simultaneously.

## Evidence and limitations

- [UX guidelines](../../spec/ux.md), accessed 2026-11-04: defines the two roles, broad permissions, multi-system ambition, and desired interface direction. It does not describe actual MG workflows or participant findings.
- [README](../../../README.md), accessed 2026-11-04: describes a frontend foundation; session management and persistence are not yet implemented.

No participant research, direct observations, or validated segmentation were found. This profile does not represent all game masters.

## Questions for research

1. What tasks do MGs perform most often during a live session, and what information must remain in view for each?
2. How do workflows and terminology differ between systems and between preparation and live play?
3. Which changes should be visible to players, and which should remain private?
4. Which mistakes are costly, and what recovery mechanisms do MGs expect?
5. What devices, screen sizes, and existing tools do MGs use during sessions?
