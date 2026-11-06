---
name: task-handover
description: Create or update a task handover with implementation acceptance criteria and verification evidence.
---

# Task Handover

Write `docs/tasks/<task>/handover.md` after planning. Read the story, UI, technical design, and plan; link the existing documents and turn their agreed requirements into observable acceptance criteria. Keep implementation sequencing in the plan. Record unresolved decisions as blockers rather than inventing requirements.

Include the relevant user journey, failure behavior, technical contracts, and approved prototype fidelity. Name the prototype components to reuse when UI is involved. Each criterion needs a concrete check; passing builds alone do not establish behavior or visual fidelity.

Keep the handover in place during implementation. Update each criterion after its wave is integrated, recording actual results and concise evidence such as a test command, test case, or browser comparison with viewport and state. Use Pending, Pass, Fail, or Blocked; a planned check is Pending. Verify delegated results before recording Pass.

When scope changes, update the owning task document and its acceptance criteria together. Keep failed or unverified criteria visible. At completion, record remaining gaps and the next action; mark the task Implemented only when required criteria pass or the user has explicitly accepted an exception. Link the handover from the task summary once it exists.

## Example: `docs/tasks/<task>/handover.md`

```markdown
# Game creation — handover

**Updated:** 2026-11-06
**Sources:** [Story](story.md) · [UI](ui.md) · [Tech](tech.md) · [Plan](plan.md)

Reuse the approved game form and list components; replace their mock data with production hooks.

## Acceptance

| Criterion | Check | Status | Evidence |
| --- | --- | --- | --- |
| Create a Fabula game, open it, and reload without losing it. | Full-stack game journey on disposable PostgreSQL. | Pending | Not run. |
| A failed list read shows an error and Retry recovers. | Browser component test with a failed response. | Pending | Not run. |
| Production form and list match the approved prototype, including empty and error states. | Compare at 375px and 1280px widths. | Pending | Not inspected. |
| Blank names and unsupported systems return validation errors. | API tests against the agreed contract. | Pending | Not run. |

## Open items

None identified. Complete the checks above before marking the task Implemented.
```
