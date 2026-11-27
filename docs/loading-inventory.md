# Frontend data-loading inventory

`SkeletonRegion` announces the request once. Its `SkeletonBlock` children are decorative grey rectangles; their gradient is static when reduced motion is enabled. Compose them inside the same layout as the result. The **Design system → Base → Content state** gallery shows the primitive.

| Read                                                | Where the result appears                                           | Loading treatment                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Current session                                     | `App`                                                              | Responsive navigation and page outline until the account or sign-in destination is known             |
| Games / supported systems                           | `GamesView`                                                        | Game rows; system-select trigger inside the labeled field                                            |
| Game metadata                                       | `GameView`, `PageBreadcrumbs`, `GameNotesView`, `ClassCatalogView` | Destination-specific header and content; breadcrumb retains its route label until the name resolves  |
| Character roster / memberships                      | `GameView`, `GameTable`, `CharacterView`                           | Settings sections, management tiles or selected sheet; table and controller labels reuse cached data |
| Invitation links / invitation token                 | `GameSettings`, `InvitationView`                                   | Link controls; preview sentence and join actions                                                     |
| Party / character sheet tabs                        | `PartyPanel`, `CharacterSheetsDrawer`                              | Responsive table cards; tab strip and sheet                                                          |
| Character detail                                    | `CharacterView`, `PlayerEquipment`                                 | Sheet fields and sections; inline equipment rows                                                     |
| Character progression and catalog                   | `CharacterView`, `PartyClassSummary`, `TableClassesCard`           | Class section, tooltip skill lines and expanded class details                                        |
| Library / game class definitions                    | `ClassCatalogController`                                           | Catalog rows or editor fields according to the route                                                 |
| NPC roster / selected NPC                           | `NpcManager`                                                       | Table card and drawer sheet; focus refresh retains current records                                   |
| Throw history                                       | `HistoryPanel`                                                     | Initial result cards; older pages preserve the current list and scroll anchor                        |
| Recent notes / search results                       | `NotesDrawerPanel`, `NotesResults`                                 | Note cards on first load; one trailing card during pagination                                        |
| Note detail                                         | `EntryDetail`                                                      | Title field, formatting toolbar and editor surface                                                   |
| Agent availability / conversation / table readiness | `AgentPanel`                                                       | Initial message bubbles and send-control placeholder; older turns retain the conversation            |
| Agent edit review                                   | `AgentEditReview`                                                  | Field differences above the existing review actions                                                  |

Event streams, focus refreshes and post-write reconciliation update existing views. Submit, roll, delete and save operations retain their action feedback. Variable-length lists use representative rows: the final count, wrapped text, role and empty/error outcomes can change content height.
