# AI chat — minimal UI solution

**Created:** 2026-11-04  
**Status:** Proposed design; not implemented.  
**Related:** [Story](story.md) · [Technical clarification](tech.md)

## Scope and basis

The user requested a small in-application chat window in the bottom-right corner, with no further UI requirements for now. This document covers that minimal chat shell. Dimensions, copy, and interaction details below are proposed defaults, not additional user requirements or validated research findings.

Provider configuration through the UI remains required by the story, but its form and placement are deferred. This chat-shell design does not claim to complete provider setup, backend integration, or gameplay automation.

The [UX guidance](../../spec/ux.md) favors a minimal interface and AI assistance. The [provisional persona](../../research/personas/game-master.md) and [simulated interview](../../research/interviews/game-master.md) are hypothetical; neither validates a chat workflow or its placement.

## Placement and appearance

- Add the window to the existing application shell without replacing or navigating away from the main content.
- Anchor it to the viewport's bottom-right with a small inset, initially open. Proposed desktop size: approximately 360 × 420 px.
- Use a compact non-modal panel: no backdrop, page dimming, focus trap, or layout-wide sidebar.
- Keep it within the available viewport on narrow or short screens, with small outer margins. The message area scrolls independently; the header and composer stay visible. Account for the on-screen keyboard so the composer remains reachable.
- Reuse the existing Nuxt UI components and theme tokens for surfaces, borders, text, buttons, and input. Use a restrained border, rounded corners, and shadow; no new design system or custom visual theme is needed.

## Contents and controls

1. **Header:** “AI chat” and a button labelled “Minimize chat.”
2. **Message area:** compact conversation entries clearly labelled “You” and “Assistant.” Empty copy: “Start a conversation with your AI assistant.” Do not populate it with fabricated replies or game activity.
3. **Composer:** a multiline field labelled “Message,” placeholder “Write a message…”, and a “Send” button.
4. **Collapsed state:** replace the panel with a small “AI chat” button in the same corner. Activating it restores the panel, not a new conversation.

No attachments, conversation list, model picker, resizing, dragging, or rich tool-execution UI in this initial shell.

## States and interactions

| State | Presentation and behavior |
| --- | --- |
| Backend not connected | Show “AI chat is not connected yet.” The user may draft a message, but Send is disabled. No network calls or simulated successful messages. This is the truthful initial application state. |
| Provider not configured, once integration exists | Show “Configure an AI provider to start chatting.” Keep drafting available and Send disabled. The provider-settings entry point is deferred with the settings design; do not add a dead setup link. |
| Ready, once integration exists | Allow sending nonempty messages. On submission, add the user's message and clear the submitted draft. |
| Waiting for a response | Show “Waiting for response…” and prevent duplicate submissions. Allow composing the next draft and minimizing the window. Minimize does not cancel the request. |
| Request failed | Show an inline, sanitized explanation. Keep the submitted text available in the conversation and preserve any next draft. Do not resend automatically or display a fabricated assistant reply. |
| Response received | Add the assistant response. Do not claim game changes occurred unless the application actually confirmed them; gameplay actions are outside this shell. |

Connected states describe the presentation boundary for later integration; they do not authorize building a backend or agent loop in the UI phase. Render message text safely; rich Markdown is not needed for the initial shell.

## Focus, keyboard, and preservation

- Do not steal focus when the application first loads, even though the panel is visible.
- Opening via the collapsed button focuses the composer. Minimizing returns focus to the collapsed button. Tab follows header control → composer → Send, skipping disabled controls; it can leave the non-modal panel normally.
- Enter sends when sending is available; Shift+Enter inserts a newline. Do not submit during input-method composition or when the message contains only whitespace. When disconnected, Enter does not discard the draft.
- Escape minimizes only when focus is inside this panel and no nested control is handling it; do not intercept Escape elsewhere in the application.
- Preserve the draft, conversation, and pending-response state while minimizing/reopening and moving within the current application session. Reopening must not duplicate a pending request.
- No persistence across page reloads is promised. Do not introduce browser storage of conversations, drafts, or provider secrets for this shell.
- Scroll to new content only when the user is already at the bottom; do not pull them away from an earlier message they are reading.

## Review outcomes

- The main application remains usable while the chat is open, and the panel fits the viewport.
- Minimize and reopen preserve a typed draft without sending it or losing focus.
- With today's disconnected foundation, the UI states that limitation and cannot pretend to contact an AI service.
- Keyboard submission, response, and error states can be verified when integration is available, without changing this basic layout.

Provider-settings controls, configuration permissions, source precedence, and persistence remain separate unresolved task decisions; this document does not settle them implicitly.
