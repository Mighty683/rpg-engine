import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { transaction } from "../../database/transaction.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import type { GameActor } from "../games/types.ts";
import { encodeNotePageCursor, noteQueryHash } from "./cursor.ts";
import { noteTextFingerprint, sameNoteDocument, visibleNoteText } from "./document.ts";
import { gameNoteEntries } from "./schema.ts";
import type {
  CreateGameNoteInput,
  GameNoteEntryRecord,
  GameNotesDependencies,
  GameNotesService,
  NoteDocument,
  NotePagePosition,
  UpdateGameNoteInput,
} from "./types.ts";

const fail = (code: string) => Object.assign(new Error(code), { code });

const pageSize = 20;

/** Exact microsecond epoch of updatedAt: JS Dates only carry milliseconds, cursors must not. */
const updatedAtMicros = sql<string>`(extract(epoch from ${gameNoteEntries.updatedAt}) * 1000000)::bigint`;

/** Concatenated insert text with the single terminal newline removed. */
export const noteEntryVisibleBody = sql<string>`(
  select left(
    string_agg(op->>'insert', '' order by ord),
    greatest(char_length(string_agg(op->>'insert', '' order by ord)) - 1, 0)
  )
  from jsonb_array_elements(${gameNoteEntries.content}->'ops') with ordinality as o(op, ord)
)`;

const entryFields = {
  id: gameNoteEntries.id,
  title: gameNoteEntries.title,
  content: gameNoteEntries.content,
  revision: gameNoteEntries.revision,
  createdAt: gameNoteEntries.createdAt,
  updatedAt: gameNoteEntries.updatedAt,
};

function present(row: {
  id: string;
  title: string;
  content: NoteDocument;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}): GameNoteEntryRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revision: row.revision,
  };
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/** Case-insensitive literal substring over the title and the visible body text. */
export function matchesNoteQuery(q: string) {
  const pattern = `%${escapeLike(q)}%`;
  return or(
    sql`lower(${gameNoteEntries.title}) like lower(${pattern}) escape '\\'`,
    sql`lower((${noteEntryVisibleBody})) like lower(${pattern}) escape '\\'`,
  );
}

/** Continue strictly after the keyset position (updatedAt DESC, then id ASC). */
function afterPosition(position: NotePagePosition) {
  return or(
    sql`${updatedAtMicros} < ${position.micros}::bigint`,
    and(
      sql`${updatedAtMicros} = ${position.micros}::bigint`,
      sql`${gameNoteEntries.id} > ${position.id}`,
    ),
  );
}

async function findEntry(tx: DatabaseTransaction, gameId: string, entryId: string) {
  const [row] = await tx
    .select(entryFields)
    .from(gameNoteEntries)
    .where(and(eq(gameNoteEntries.gameId, gameId), eq(gameNoteEntries.id, entryId)));
  return row ?? null;
}

/** Creates the transaction-bound Game notes service. */
export function createGameNotesService({
  database,
  gameAccessFor,
  onTextCommitted,
}: GameNotesDependencies): GameNotesService {
  async function list(
    actor: GameActor,
    gameId: string,
    query: { q: string | null; position: NotePagePosition | null },
  ) {
    return transaction(
      database,
      async (tx) => {
        const access = await gameAccessFor(tx).gameAccess(actor, gameId);
        if (!access) throw fail("not_found");
        if (access.role !== "GM") throw fail("forbidden");
        const rows = await tx
          .select({ ...entryFields, micros: updatedAtMicros })
          .from(gameNoteEntries)
          .where(
            and(
              eq(gameNoteEntries.gameId, gameId),
              query.q ? matchesNoteQuery(query.q) : undefined,
              query.position ? afterPosition(query.position) : undefined,
            ),
          )
          .orderBy(desc(gameNoteEntries.updatedAt), asc(gameNoteEntries.id))
          .limit(pageSize + 1);
        const page = rows.slice(0, pageSize);
        const last = page[page.length - 1];
        return {
          entries: page.map(present),
          nextCursor:
            rows.length > pageSize && last
              ? encodeNotePageCursor(
                  { id: last.id, micros: last.micros },
                  { gameId, queryHash: noteQueryHash(query.q) },
                )
              : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async function read(actor: GameActor, gameId: string, entryId: string) {
    return transaction(
      database,
      async (tx) => {
        const access = await gameAccessFor(tx).gameAccess(actor, gameId);
        if (!access) throw fail("not_found");
        if (access.role !== "GM") throw fail("forbidden");
        const row = await findEntry(tx, gameId, entryId);
        if (!row) throw fail("not_found");
        return present(row);
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async function create(actor: GameActor, gameId: string, input: CreateGameNoteInput) {
    return transaction(database, async (tx, afterCommit) => {
      const access = await gameAccessFor(tx).lockGame(actor, gameId);
      if (access.role !== "GM") throw fail("forbidden");
      const [row] = await tx
        .insert(gameNoteEntries)
        .values({
          id: input.id,
          gameId,
          title: input.title,
          content: input.content,
          textFingerprint: noteTextFingerprint(input.title, input.content),
        })
        .onConflictDoNothing()
        .returning(entryFields);
      if (!row) throw fail("id_conflict");
      afterCommit(() => onTextCommitted?.(gameId, input.id));
      return present(row);
    });
  }

  async function update(
    actor: GameActor,
    gameId: string,
    entryId: string,
    input: UpdateGameNoteInput,
  ) {
    return transaction(database, async (tx, afterCommit) => {
      const access = await gameAccessFor(tx).lockGame(actor, gameId);
      if (access.role !== "GM") throw fail("forbidden");
      const current = await findEntry(tx, gameId, entryId);
      if (!current) throw fail("not_found");
      if (current.revision !== input.expectedRevision) throw fail("stale_revision");
      const title = input.changes.title ?? current.title;
      const content = input.changes.content ?? current.content;
      const titleChanged =
        input.changes.title !== undefined && input.changes.title !== current.title;
      const contentChanged =
        input.changes.content !== undefined &&
        !sameNoteDocument(input.changes.content, current.content);
      if (!titleChanged && !contentChanged) return present(current);
      const textChanged =
        titleChanged ||
        (contentChanged &&
          visibleNoteText(input.changes.content!) !== visibleNoteText(current.content));
      const [row] = await tx
        .update(gameNoteEntries)
        .set({
          title,
          content,
          revision: current.revision + 1,
          updatedAt: new Date(),
          ...(textChanged ? { textFingerprint: noteTextFingerprint(title, content) } : {}),
        })
        .where(and(eq(gameNoteEntries.gameId, gameId), eq(gameNoteEntries.id, entryId)))
        .returning(entryFields);
      if (textChanged) afterCommit(() => onTextCommitted?.(gameId, entryId));
      return present(row!);
    });
  }

  return { list, read, create, update };
}
