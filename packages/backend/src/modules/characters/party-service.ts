import type { PartyCharacter, PartyWeapon, Row } from "./types.ts";
import type { FabulaSheet } from "../fabula/types.ts";
import type { GameAccessFactory, GameActor, GameAccess } from "../games/types.ts";
import { transaction } from "../../database/transaction.ts";
import { and, eq, inArray } from "drizzle-orm";
import {
  activeCharacterCondition,
  characterFields,
  characters,
  players,
  characterClasses,
  characterEquipment,
  equipmentFields,
} from "../../database/schema.ts";
// Game Table active-party projection: a consistent batched read of each active
// character's sheet fields and derived values for the compact party cards. Active
// criteria match the roster: GM-controlled characters need gm_active, player-
// controlled characters must be the member's current active choice.
import type { Database, DatabaseTransaction } from "../../database/types.ts";
import { preview } from "../fabula/rules.ts";
import { assembleSheet } from "./mapping.ts";

const fail = (code: string) => Object.assign(new Error(code), { code });

async function batchedSheets(
  tx: DatabaseTransaction,
  rows: Row[],
): Promise<Map<string, FabulaSheet>> {
  const ids = rows.map((row) => row.id);
  const classes = await tx
    .select({
      id: characterClasses.id,
      character_id: characterClasses.characterId,
      name: characterClasses.name,
      notes: characterClasses.notes,
      position: characterClasses.position,
    })
    .from(characterClasses)
    .where(inArray(characterClasses.characterId, ids))
    .orderBy(characterClasses.characterId, characterClasses.position);
  const equipment = await tx
    .select(equipmentFields)
    .from(characterEquipment)
    .where(inArray(characterEquipment.characterId, ids))
    .orderBy(characterEquipment.characterId, characterEquipment.position);
  const byCharacter = <T extends { character_id: string }>(list: T[]) => {
    const map = new Map<string, T[]>();
    for (const entry of list) {
      const group = map.get(entry.character_id) ?? [];
      group.push(entry);
      map.set(entry.character_id, group);
    }
    return map;
  };
  const classMap = byCharacter(classes);
  const equipmentMap = byCharacter(equipment);
  return new Map(
    rows.map((row) => {
      const sheet = assembleSheet(row, {
        classes: classMap.get(row.id) ?? [],
        skills: [],
        equipment: equipmentMap.get(row.id) ?? [],
      });
      return [row.id, sheet] as const;
    }),
  );
}

/** Derives the viewer's roll capability from current access, independently of sheet edit rights. */
function canRoll(access: GameAccess, playerId: string | null) {
  return access.role === "GM" || access.membershipId === playerId;
}

export async function listActiveParty(
  { gameAccessFor, database }: { gameAccessFor: GameAccessFactory; database: Database },
  actor: GameActor,
  gameId: string,
) {
  return transaction(
    database,
    async (tx) => {
      const access = await gameAccessFor(tx).gameAccess(actor, gameId);
      if (!access) throw fail("not_found");
      const activeRows = await tx
        .select(characterFields)
        .from(characters)
        .leftJoin(
          players,
          and(eq(players.id, characters.playerId), eq(players.gameId, characters.gameId)),
        )
        .where(and(eq(characters.gameId, gameId), activeCharacterCondition()))
        .orderBy(characters.createdAt, characters.id);
      const sheets = await batchedSheets(tx, activeRows);
      const party: PartyCharacter[] = activeRows.map((row) => {
        const sheet = sheets.get(row.id)!;
        const derived = preview(sheet);
        const weapons: PartyWeapon[] = sheet.equipment
          .filter(
            (entry): entry is Extract<typeof entry, { kind: "weapon" }> => entry.kind === "weapon",
          )
          .map((weapon) => ({
            id: weapon.id,
            name: weapon.name,
            equipped: weapon.equipped,
            accuracyDice: weapon.accuracyDice,
            accuracyBonus: weapon.accuracyBonus,
            ready: Boolean(
              weapon.accuracyDice[0] && weapon.accuracyDice[1] && weapon.accuracyBonus !== null,
            ),
          }));
        return {
          id: row.id,
          revision: row.revision,
          name: sheet.name,
          classes: sheet.classes.map((entry) => entry.name),
          baseDice: { ...sheet.baseDice },
          resources: { ...sheet.resources },
          maxima: { ...derived.maxima },
          defense: sheet.overrides.defense ?? derived.defenses.defense.calculated,
          magicDefense: sheet.overrides.magicDefense ?? derived.defenses.magicDefense.calculated,
          weapons,
          canRoll: canRoll(access, row.player_id),
        };
      });
      return { characters: party };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
