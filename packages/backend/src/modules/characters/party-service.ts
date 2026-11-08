import type { EquipmentRow, PartyCharacter, PartyWeapon, Row } from "./types.ts";
import type { Attribute, FabulaSheet } from "../fabula/types.ts";
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
import { preview, validateSheet } from "../fabula/rules.ts";

const fail = (code: string) => Object.assign(new Error(code), { code });

function equipmentEntry(row: EquipmentRow) {
  const base = { id: row.id, name: row.name, notes: row.notes, priceZenit: row.price_zenit };
  if (row.kind === "weapon")
    return {
      ...base,
      kind: "weapon" as const,
      equipped: Boolean(row.equipped),
      accuracyDice: [row.accuracy_attribute_1, row.accuracy_attribute_2] as [
        Attribute | null,
        Attribute | null,
      ],
      accuracyBonus: row.accuracy_bonus,
    };
  if (row.kind === "armor")
    return {
      ...base,
      kind: "armor" as const,
      equipped: Boolean(row.equipped),
      fixedDefense: row.fixed_defense,
      defenseBonus: row.defense_bonus ?? 0,
      magicDefenseBonus: row.magic_defense_bonus ?? 0,
      initiativeModifier: row.initiative_modifier ?? 0,
    };
  if (row.kind === "shield")
    return {
      ...base,
      kind: "shield" as const,
      equipped: Boolean(row.equipped),
      defenseBonus: row.defense_bonus ?? 0,
      magicDefenseBonus: row.magic_defense_bonus ?? 0,
      initiativeModifier: row.initiative_modifier ?? 0,
    };
  return { ...base, kind: "other" as const };
}

async function batchedSheets(tx: DatabaseTransaction, rows: Row[]): Promise<Map<string, FabulaSheet>> {
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
      const sheet = validateSheet({
        name: row.name,
        theme: row.theme,
        level: row.level,
        baseDice: { DEX: row.dex_die, INS: row.ins_die, MIG: row.mig_die, WLP: row.wlp_die },
        classes: (classMap.get(row.id) ?? []).map(({ id, name, notes }) => ({ id, name, notes })),
        skills: [],
        equipment: (equipmentMap.get(row.id) ?? []).map(equipmentEntry),
        resources: {
          hp: row.current_hp,
          mp: row.current_mp,
          ip: row.current_ip,
          fabula: row.fabula_points,
        },
        overrides: {
          maxHp: row.max_hp_override,
          maxMp: row.max_mp_override,
          maxIp: row.max_ip_override,
          defense: row.defense_override,
          magicDefense: row.magic_defense_override,
          initiative: row.initiative_override,
        },
      });
      return [row.id, sheet] as const;
    }),
  );
}

/** Derives the viewer's roll capability from current access, independently of sheet edit rights. */
function canRoll(access: GameAccess, playerId: string | null) {
  return access.role === "GM" || access.membershipId === playerId;
}

export async function listActiveParty({ gameAccessFor, database }: { gameAccessFor: GameAccessFactory; database: Database }, actor: GameActor, gameId: string) {
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
