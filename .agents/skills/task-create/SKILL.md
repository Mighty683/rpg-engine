---
name: task-create
description: Create or update a task navigation page linking its phase documents, and archive implemented tasks.
---

# Task Create

Use the existing task directory or a descriptive kebab-case name. Link only existing documents, including the handover once created. Preserve creation metadata; when reducing an existing summary, move unique detail to its owning phase and update references.

After implementation, set the task status to Implemented and move the complete task directory from `docs/tasks/<task>/` to `docs/tasks/archive/<task>/`. Update links to and from the moved documents. Preserve any outstanding verification or open items.

Link the single `ux.md` for the task’s user flow, screen design, and prototype decisions.

## Example: `docs/tasks/<task>/summary.md`

```markdown
# <task title>

**Created:** 2026-11-04
**Status:** <Created/Story/UX/Tech/Plan/Handover/Implemented/Dropped>

## Task documents

1. [User story](story.md)
2. [UX and prototype design](ux.md)
3. [Technical design](tech.md)
4. [Implementation plan](plan.md)
5. [Handover](handover.md)
```
