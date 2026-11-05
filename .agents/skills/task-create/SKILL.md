---
name: task-create
description: Create or update a task navigation page linking its phase documents.
---

# Task Create

Use the existing task directory or a descriptive kebab-case name. Link only existing documents. Preserve creation metadata; when reducing an existing summary, move unique detail to its owning phase and update references.

## Example: `docs/tasks/<task>/summary.md`

```markdown
# <task title>

**Created:** 2026-11-04
**Status:** <Created/Story/UX/UI/Tech/Plan/Implemented/Dropped>

## Task documents

1. [User story](story.md)
2. [UX journey](ux.md)
3. [UI solution](ui.md)
4. [Technical design](tech.md)
5. [Implementation plan](plan.md)
```
