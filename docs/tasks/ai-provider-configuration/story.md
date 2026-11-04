# AI provider configuration — user story

**Created:** 2026-11-04

## User story

As an application operator, I want to configure Mistral AI through the backend environment, so that the application can use AI without changing application code. As an application user, I want a minimal chat interface that communicates its connection state honestly.

## Acceptance outcomes

1. An operator can configure Mistral AI and its model through a backend `.env` file without changing application code.
2. With valid configuration, an application AI request uses Mistral and the configured model. Provider SDK details are isolated from domain code so another provider can be integrated later.
3. Missing or invalid configuration, rejected credentials, unavailable services, and incompatible responses produce understandable feedback without falsely reporting success or silently switching providers.
4. Environment changes take effect after a backend restart, and this requirement is documented.
5. Credentials are not exposed in frontend code, ordinary output, logs, or error messages.
6. The minimal chat follows [ui.md](ui.md) and sends text to Mistral through the backend when configured, including a truthful disconnected state when unavailable. It does not execute tools or game actions.

## Scope

Mistral is the only initial provider and uses its official SDK. Configuration is deployment-wide and environment-only. Provider settings management in the application, additional providers, login, and an operator-controlled network policy are outside this task. UI settings persistence and source precedence are therefore not applicable.

The application currently has no backend server or AI action. Chat is the first application AI action, limited to text without tools. Run the initial deployment only in a trusted environment; shared or public deployment requires appropriate security controls that are not part of this task.

## Evidence and related work

The scope reflects the owner's clarification on 2026-11-04. The [README](../../../README.md) describes a frontend foundation without an implemented backend server or session persistence. The [technical clarification](tech.md), [UI solution](ui.md), and [implementation plan](plan.md) describe the proposed work; none is implemented.
