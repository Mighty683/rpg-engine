# AI provider configuration — user story

**Created:** 2026-11-04

## User story

As an application user, I want to connect my choice of OpenAI- or Anthropic-compatible AI service through either the in-game UI or a `.env` file, so that I can use the application's AI capabilities without being tied to one provider or changing application code.

## Acceptance outcomes

1. A user can configure an AI provider through the in-game UI without editing a `.env` file or application code.
2. A person running the application can configure an AI provider through a `.env` file without completing setup in the UI or changing application code.
3. Either configuration route can supply the information required by the chosen provider. With valid configuration, an application AI request uses that provider and the selected model, where applicable.
4. The user can determine which provider and model are effective and whether configuration comes from the UI or `.env`. When both sources are present, a documented precedence rule produces a predictable result.
5. Missing or invalid configuration, rejected credentials, unavailable providers, and incompatible services produce understandable feedback without falsely reporting a successful connection or silently switching providers.
6. A user can replace an existing provider configuration through the UI; after the change takes effect, subsequent AI requests use the replacement. Any required reload or restart is made clear for either configuration route.
7. Provider credentials are not revealed to other users or exposed in ordinary application output, logs, or error messages.
8. Both configuration routes let the user select the API compatibility family, endpoint including its URL path, model identifier, and authentication. Connecting a compatible service does not require its provider name to appear in a built-in catalogue.

## Scope and decisions still needed

- **Provider coverage — clarified:** “Any” means any service compatible with the supported OpenAI or Anthropic API contracts and authentication options, not every proprietary AI API. The user explicitly proposed SDK-family selection plus endpoint and authorization configuration. Exact API variants and capability boundaries are specified in the [technical clarification](tech.md); compatibility claims must be verified, not inferred from a provider name.
- **Ownership and access:** Decide whether configuration applies to an application deployment, a game, or an individual user, and who may view or change it. Do not assume every player can change shared settings.
- **Source precedence and persistence:** Decide which source wins when both are configured, how long UI settings persist, and what happens when a UI override is removed. These decisions must preserve both independent setup routes.
- **AI capability used for verification:** Identify the application AI action that demonstrates a working connection; this story does not define a new gameplay AI feature.

## Evidence and assumptions

- **Direct requirement:** The user's request establishes provider choice and both in-game UI and `.env` configuration as desired capabilities.
- **Direct clarification:** The user proposed OpenAI and Anthropic compatibility families, with configurable SDK choice, URL path, and authorization, instead of separate integrations for individual providers. The claim that most services fit these families is a working assumption, not a verified market survey.
- **Product context:** The [UX guidelines](../../spec/ux.md) call for AI assistance and distinguish game-master authority from players' personal scope. They do not define AI configuration permissions.
- **Current foundation:** The [README](../../../README.md) describes a frontend foundation without an implemented backend server or session persistence. This story specifies desired outcomes, not existing capabilities.
- **Research limitation:** The [game-master persona](../../research/personas/game-master.md) and [simulated interview](../../research/interviews/game-master.md) are explicitly hypothetical. Neither validates provider preferences, setup workflows, or demand for this feature.
- **Benefit hypothesis:** Provider choice is expected to reduce dependence on one service. No participant research currently establishes users' preferred providers or reasons for switching.

The [UI solution](ui.md) records the requested minimal bottom-right chat window; provider-settings controls remain deferred. The [technical clarification](tech.md) records the integration boundary and remaining implementation decisions.
