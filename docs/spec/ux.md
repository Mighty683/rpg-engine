# UX guidelines

- We want to create RPG engine which will be able to run different systems of RPG
- We will have two main users MG and player, MG can manage everything, player only it's personal scope
- For now, assume the application is run by one person acting as the single GM; player workflows are deferred.
- UI should be sleek and minimal, we want to keep all is needed to run a game on the screen visible at all time
- Communicate every API error through a toast that clearly explains what happened and, when possible, what the user can do next. Do not show API error messages as red text in the interface.
- Do not care about WCAG
- We will try to make it AI first, any operation done by users can be done by prompting it to agent which will manage the session
