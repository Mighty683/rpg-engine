/** Game notes request contract: envelopes, document shape, and query parsing. */
import { compileObjectSchema } from "../../shared/validation/parse.ts";
import type { ObjectInputSchema } from "../../shared/validation/types.ts";
import { parseEnvelope } from "../../shared/http/validation.ts";
import { badRequest, validationError } from "../../shared/http/errors.ts";
import type { ValidationFields } from "../../shared/validation/types.ts";
import { uuidSchema } from "../../shared/validation/schema.ts";
import { normalizeNoteDocument, noteTitleIssue, type NoteInputDocument } from "./document.ts";
import type { CreateGameNoteInput, NoteDocument, UpdateGameNoteInput } from "./types.ts";

const noteInsertSchema = {
  type: "object",
  required: ["insert"],
  additionalProperties: false,
  properties: {
    insert: { type: "string", minLength: 1 },
    attributes: {
      type: "object",
      additionalProperties: false,
      properties: {
        bold: { type: "boolean", const: true },
        italic: { type: "boolean", const: true },
        underline: { type: "boolean", const: true },
        strike: { type: "boolean", const: true },
        header: { type: "integer", enum: [1, 2, 3] },
        list: { type: "string", enum: ["bullet", "ordered"] },
      },
    },
  },
} as const;

/** Title bounds apply to the trimmed value, so they stay out of the 400-stage envelope. */
export const noteTitleSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "string",
  minLength: 1,
  maxLength: 160,
} as const;

/** Full Quill document Delta: structural violations are unsupported formats (400). */
export const noteContentSchema: ObjectInputSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["ops"],
  additionalProperties: false,
  properties: {
    ops: { type: "array", minItems: 1, items: noteInsertSchema },
  },
};

const noteRevisionSchema = { type: "integer", minimum: 0, maximum: 2147483647 } as const;

/**
 * Envelopes keep 400 (shape) before 422 (normalized field semantics): unknown
 * fields, unsupported operations, and unsupported formats return 400; invalid
 * attribute placement, terminal-newline, and limit violations return 422.
 */
export const noteCreateSchema: ObjectInputSchema = {
  type: "object",
  required: ["id", "title", "content"],
  additionalProperties: false,
  properties: {
    id: uuidSchema,
    title: { type: "string" },
    content: noteContentSchema,
  },
};

export const noteUpdateChangesSchema: ObjectInputSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string" },
    content: noteContentSchema,
  },
};

export const noteUpdateSchema: ObjectInputSchema = {
  type: "object",
  required: ["expectedRevision", "changes"],
  additionalProperties: false,
  properties: {
    expectedRevision: noteRevisionSchema,
    changes: noteUpdateChangesSchema,
  },
};

const validateContent = compileObjectSchema(noteContentSchema);
const validateCreate = compileObjectSchema(noteCreateSchema);
const validateUpdate = compileObjectSchema(noteUpdateSchema);

function parseTitle(value: string) {
  const title = value.trim();
  const issue = noteTitleIssue(title);
  if (issue) validationError({ title: issue });
  return title;
}

function parseContent(value: unknown): NoteDocument {
  if (!validateContent(value)) badRequest("Unsupported note format.");
  const result = normalizeNoteDocument(value as NoteInputDocument);
  if (!result.ok) validationError({ [result.issues.field]: result.issues.messages[0]! });
  return result.document;
}

export function parseCreateNote(value: unknown): CreateGameNoteInput {
  const body = parseEnvelope(validateCreate, value);
  return {
    id: body.id as string,
    title: parseTitle(body.title as string),
    content: parseContent(body.content),
  };
}

export function parseUpdateNote(value: unknown): UpdateGameNoteInput {
  const body = parseEnvelope(validateUpdate, value);
  const changes = body.changes as Record<string, unknown>;
  const fields: ValidationFields = {};
  if ("title" in changes) {
    const issue = noteTitleIssue((changes.title as string).trim());
    if (issue) fields.title = issue;
  }
  const hasContent = "content" in changes;
  if (hasContent && !validateContent(changes.content)) badRequest("Unsupported note format.");
  const content = hasContent ? normalizeNoteDocument(changes.content as NoteInputDocument) : null;
  if (content && !content.ok) fields[content.issues.field] = content.issues.messages[0]!;
  if (Object.keys(fields).length) validationError(fields);
  return {
    expectedRevision: body.expectedRevision as number,
    changes: {
      ...("title" in changes ? { title: (changes.title as string).trim() } : {}),
      ...(content?.ok ? { content: content.document } : {}),
    },
  };
}

/** Blank or missing queries browse all entries; malformed values are rejected. */
export function parseNoteListQuery(query: Record<string, unknown>) {
  if (query.q !== undefined && typeof query.q !== "string") badRequest("Invalid query.");
  if (query.cursor !== undefined && typeof query.cursor !== "string") badRequest("Invalid cursor.");
  const trimmed = typeof query.q === "string" ? query.q.trim() : "";
  return {
    q: trimmed || null,
    cursor: typeof query.cursor === "string" && query.cursor ? query.cursor : null,
  };
}
