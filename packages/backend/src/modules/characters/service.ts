import type { Row } from "./types.ts";
import type { FabulaSheet } from "../fabula/types.ts";
import { eq } from "drizzle-orm";
import {
  characterClasses,
  characterSkills,
  characterEquipment,
  equipmentFields,
} from "../../database/schema.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import { preview } from "../fabula/rules.ts";
import { assembleSheet } from "./mapping.ts";

export async function sheetSequential(tx: DatabaseTransaction, r: Row): Promise<FabulaSheet> {
  const db = tx;
  const classes = await db
    .select({
      id: characterClasses.id,
      name: characterClasses.name,
      notes: characterClasses.notes,
      position: characterClasses.position,
    })
    .from(characterClasses)
    .where(eq(characterClasses.characterId, r.id))
    .orderBy(characterClasses.position);
  const skills = await db
    .select({
      id: characterSkills.id,
      name: characterSkills.name,
      notes: characterSkills.notes,
      position: characterSkills.position,
    })
    .from(characterSkills)
    .where(eq(characterSkills.characterId, r.id))
    .orderBy(characterSkills.position);
  const equipment = await db
    .select(equipmentFields)
    .from(characterEquipment)
    .where(eq(characterEquipment.characterId, r.id))
    .orderBy(characterEquipment.position);
  return assembleSheet(r, { classes, skills, equipment });
}

export const present = (r: Row, s: FabulaSheet) => ({
  id: r.id,
  playerId: r.player_id,
  name: s.name,
  level: s.level,
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
  revision: r.revision,
  systemId: "fabula-ultima" as const,
  sheet: s,
  derived: preview(s),
});
