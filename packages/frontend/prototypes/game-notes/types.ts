import type { Op } from "quill";

export type NoteDocument = { ops: Op[] };
export type EntryText = { title: string; content: NoteDocument };
export type Entry = EntryText & {
  id: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
};
export interface NotesApi {
  list(): Promise<Entry[]>;
  create(id: string, text: EntryText): Promise<Entry>;
  update(entry: Entry, text: Partial<EntryText>): Promise<Entry>;
}
