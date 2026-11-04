# AI chat — minimal UI solution

**Created:** 2026-11-04  
**Status:** Proposed design; not implemented.  
**Related:** [Story](story.md) · [Technical clarification](tech.md)

## Scope and basis

The user requested a small in-application chat window in the bottom-right corner. Dimensions, copy, and interaction details below are proposed defaults, not validated research findings. Provider configuration is deployment-wide and environment-only; this task has no in-application provider settings.

The [UX guidance](../../spec/ux.md) favors a minimal interface and AI assistance. The [provisional persona](../../research/personas/game-master.md) and [simulated interview](../../research/interviews/game-master.md) are hypothetical; neither validates this chat workflow.

## Placement and controls

- Add an initially open, non-modal panel to the application shell, anchored bottom-right with a small inset. Proposed desktop size: approximately 360 × 420 px. Keep it within narrow or short viewports and reachable with the on-screen keyboard.
- Reuse Nuxt UI components and theme tokens. The message area scrolls independently; the header and composer remain visible.
- Header: “AI chat” and a “Minimize chat” button. Collapsed state: an “AI chat” button in the same corner.
- Label conversation entries “You” and “Assistant”; empty copy: “Start a conversation with your AI assistant.” Composer: multiline “Message” field, placeholder “Write a message…”, and “Send”.
- No attachments, conversation list, model picker, resizing, dragging, rich tool UI, or fabricated activity.

## States and interactions

| State | Presentation and behavior |
| --- | --- |
| Backend not connected | Show “AI chat is not connected yet.” Allow drafting, disable Send, and make no network calls or simulated successful messages. |
| Provider not configured, once integration exists | Show a sanitized configuration-unavailable message; allow drafting and disable Send. |
| Ready, once integration exists | Allow sending nonempty messages. Add the user's message and clear the submitted draft. |
| Waiting | Show “Waiting for response…” and prevent duplicate submissions. Allow a next draft and minimizing without cancelling. |
| Failed | Show a sanitized inline explanation. Keep the submitted text and any next draft; do not automatically resend or fabricate a reply. |
| Received | Add the assistant response. Do not claim unconfirmed game changes. |

Chat is the first application AI action and connects to Mistral through the backend for text responses. Tools and game actions are out of scope. Render text safely; rich Markdown is not required.

## Focus and preservation

- Do not steal focus on initial load. Opening focuses the composer; minimizing returns focus to the collapsed button. Tab follows header control → composer → Send, then leaves the non-modal panel normally.
- Enter sends when available; Shift+Enter inserts a newline. Do not submit during input-method composition or for whitespace only. Disconnected Enter must not discard the draft.
- Escape minimizes only with focus inside the panel and no nested control handling it. Preserve draft, conversation and pending state when minimizing and reopening; do not duplicate a request.
- Do not promise persistence across reloads or add browser storage. Scroll to new content only if the user is already at the bottom.

## Review outcomes

The main application remains usable; the panel fits the viewport; minimizing preserves drafts and focus; and the disconnected foundation never pretends to contact an AI service. Verify connected keyboard, response, and error states when integration exists.
