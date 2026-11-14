/** Active roster joins are a read projection. No membership or throw writes occur here. */
import { and, eq } from "drizzle-orm";
import {
  characters,
  characterFields,
  players,
  activeCharacterCondition,
} from "../../database/schema.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import type { CharacterRollReader, RollCharacter } from "./types.ts";
import { sheetSequential } from "./service.ts";
async function activeCharacterIds(tx: DatabaseTransaction, gameId: string) {
  const result = await tx
    .select({ id: characters.id })
    .from(characters)
    .leftJoin(
      players,
      and(eq(players.id, characters.playerId), eq(players.gameId, characters.gameId)),
    )
    .where(and(eq(characters.gameId, gameId), activeCharacterCondition()));
  return result.map((row) => row.id);
}

async function ownActiveCharacterId(tx: DatabaseTransaction, gameId: string, membershipId: string) {
  const [result] = await tx
    .select({ activeCharacterId: players.activeCharacterId })
    .from(players)
    .where(
      and(eq(players.id, membershipId), eq(players.gameId, gameId), eq(players.removed, false)),
    );
  return result?.activeCharacterId ?? null;
}

async function loadCharacter(
  tx: DatabaseTransaction,
  gameId: string,
  characterId: string,
): Promise<RollCharacter | null> {
  const [row] = await tx
    .select(characterFields)
    .from(characters)
    .where(and(eq(characters.gameId, gameId), eq(characters.id, characterId)));
  if (!row) return null;
  const sheet = await sheetSequential(tx, row);
  return { id: row.id, playerId: row.player_id, revision: row.revision, name: sheet.name, sheet };
}

export function createCharacterRollReader(tx: DatabaseTransaction): CharacterRollReader {
  return {
    activeIds: (gameId) => activeCharacterIds(tx, gameId),
    ownActiveId: (gameId, membershipId) => ownActiveCharacterId(tx, gameId, membershipId),
    load: (gameId, id) => loadCharacter(tx, gameId, id),
  };
}
