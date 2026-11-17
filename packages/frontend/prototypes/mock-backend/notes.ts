import { HttpResponse } from "msw";
import type { Entry, EntryText } from "../game-notes/types";

export function seedNotes(): Entry[] {
  return [
    {
      id: "f34dd6ea-cdfe-4ee5-9cc8-39e5fc68a5c1",
      title: "The ferryman’s price",
      content: "Mara will take the party across at dawn. She wants her brass compass back.",
      createdAt: "2026-11-12T18:30:00Z",
      updatedAt: "2026-11-15T20:14:00Z",
      revision: 2,
    },
    {
      id: "c050c559-4ca6-4887-a890-c3ae0d57b26b",
      title: "Below the old mill",
      content: "The third bell opens the sluice. Rowan still has the key.",
      createdAt: "2026-11-10T19:20:00Z",
      updatedAt: "2026-11-10T19:20:00Z",
      revision: 1,
    },
  ];
}

export function handleNotes(
  entries: Entry[],
  method: string,
  entryId: string | undefined,
  body: Record<string, any>,
) {
  if (method === "GET" && !entryId) return HttpResponse.json({ entries });
  const current = entries.find((entry) => entry.id === (entryId ?? body.id));
  const fail = (status: number) => HttpResponse.json({ error: { code: "note_error" } }, { status });
  const now = new Date().toISOString();
  if (method === "POST" && !entryId) {
    if (current) return fail(409);
    if (!body.title?.trim() || typeof body.content !== "string") return fail(422);
    const entry = {
      id: body.id,
      title: body.title.trim(),
      content: body.content,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    entries.unshift(entry);
    return HttpResponse.json({ entry }, { status: 201 });
  }
  if (method !== "PATCH" || !current) return fail(404);
  if (body.expectedRevision !== current.revision) return fail(409);
  const changes = body.changes as Partial<EntryText>;
  const title = (changes.title ?? current.title).trim();
  const content = changes.content ?? current.content;
  if (!title || title.length > 160 || content.length > 16000) return fail(422);
  if (title !== current.title || content !== current.content)
    Object.assign(current, { title, content, updatedAt: now, revision: current.revision + 1 });
  return HttpResponse.json({ entry: current });
}
