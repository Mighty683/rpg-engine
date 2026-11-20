import type { NoteDocument } from "./types.ts";

/**
 * Passage splitting for semantic indexing. Passages are derived from the
 * visible body text only — never Quill formatting, record IDs, game IDs, or
 * account IDs — and the note title is included separately in each embedding
 * input. Passages never cross heading lines; the heading structure is only
 * consulted at indexing time, so heading-only edits join the next
 * text-triggered indexing run (the entry text fingerprint is unchanged in
 * between). Notes within the passage budget stay one passage.
 */

/** mistral-embed produces 1024-dimensional vectors; the passage column matches. */
export const noteEmbeddingDimensions = 1024;
export const notePassageCodePoints = 800;
export const notePassageOverlapCodePoints = 200;

export type NotePassageText = { ordinal: number; text: string; embeddingInput: string };

/** Line starts (in code point offsets within the visible text) of heading lines. */
function headingSectionStarts(document: NoteDocument): number[] {
  const boundaries = new Set<number>();
  let offset = 0;
  let lineStart = 0;
  for (const op of document.ops) {
    for (const character of Array.from(op.insert)) {
      if (character === "\n") {
        if (op.attributes?.header !== undefined && lineStart > 0) boundaries.add(lineStart);
        lineStart = offset + 1;
      }
      offset += 1;
    }
  }
  return [...boundaries].sort((a, b) => a - b);
}

function sectionChunks(section: readonly string[]): string[] {
  const limit = notePassageCodePoints;
  const stride = limit - notePassageOverlapCodePoints;
  const texts: string[] = [];
  for (let start = 0; start < section.length; start += stride) {
    texts.push(section.slice(start, Math.min(start + limit, section.length)).join(""));
    if (start + limit >= section.length) break;
  }
  return texts;
}

/** One passage per ≤800-code-point chunk within each heading-delimited section. */
export function splitNotePassages(title: string, document: NoteDocument): NotePassageText[] {
  const raw = document.ops.map((op) => op.insert).join("");
  const visible = Array.from(raw.endsWith("\n") ? raw.slice(0, -1) : raw);
  const passage = (text: string, ordinal: number): NotePassageText => ({
    ordinal,
    text,
    embeddingInput: text ? `${title}\n\n${text}` : title,
  });
  if (!visible.length) return [passage("", 0)];
  if (visible.length <= notePassageCodePoints) return [passage(visible.join(""), 0)];
  const sectionStarts = [0, ...headingSectionStarts(document), visible.length];
  const texts: string[] = [];
  for (let index = 0; index + 1 < sectionStarts.length; index += 1) {
    const section = visible.slice(sectionStarts[index]!, sectionStarts[index + 1]!);
    if (section.length) texts.push(...sectionChunks(section));
  }
  return texts.map((text, ordinal) => passage(text, ordinal));
}
