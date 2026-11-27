import { HttpResponse } from "msw";
import {
  noteDocument,
  noteTextLimit,
  sameNoteDocument,
  visibleNoteText,
} from "../game-notes/note-document";
import type { Entry, EntryText, NoteDocument } from "../game-notes/types";

function validContent(content: NoteDocument | undefined) {
  if (!Array.isArray(content?.ops)) return false;
  const lastInsert = content.ops.at(-1)?.insert;
  return (
    typeof lastInsert === "string" &&
    lastInsert.endsWith("\n") &&
    content.ops.every((op) => typeof op?.insert === "string") &&
    Array.from(visibleNoteText(content)).length <= noteTextLimit
  );
}

export function seedNotes(): Entry[] {
  return [
    {
      id: "f34dd6ea-cdfe-4ee5-9cc8-39e5fc68a5c1",
      title: "The ferryman’s price",
      content: noteDocument(
        "Mara will take the party across at dawn. She wants her brass compass back.",
      ),
      createdAt: "2026-11-12T18:30:00Z",
      updatedAt: "2026-11-15T20:14:00Z",
      revision: 2,
    },
    {
      id: "c050c559-4ca6-4887-a890-c3ae0d57b26b",
      title: "Below the old mill",
      content: noteDocument("The third bell opens the sluice. Rowan still has the key."),
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
  const fail = (status: number, code: string) => HttpResponse.json({ error: { code } }, { status });
  const now = new Date().toISOString();
  if (method === "POST" && !entryId) {
    if (current) return fail(409, "ERR01");
    if (!body.title?.trim() || !validContent(body.content)) return fail(422, "ERR84");
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
  if (method !== "PATCH" || !current) return fail(404, method === "GET" ? "ERR01" : "ERR83");
  if (body.expectedRevision !== current.revision) return fail(409, "ERR01");
  const changes = body.changes as Partial<EntryText>;
  const title = (changes.title ?? current.title).trim();
  const content = changes.content ?? current.content;
  if (!title || title.length > 160 || !validContent(content)) return fail(422, "ERR84");
  if (title !== current.title || !sameNoteDocument(content, current.content))
    Object.assign(current, { title, content, updatedAt: now, revision: current.revision + 1 });
  return HttpResponse.json({ entry: current });
}
