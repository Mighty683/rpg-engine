import { databaseFromPool } from "../../../backend/src/database/client.ts";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { inject } from "vite-plus/test";
import { registerAccount } from "../../../backend/src/modules/auth/service.ts";
import { createActorGame } from "../../../backend/src/modules/games/service.ts";
import {
  createWorkspaceCharacter,
  setGmCharacterActive,
  updateWorkspaceCharacter,
} from "../../../backend/src/modules/characters/workspace-service.ts";

export type SeededAccount = { username: string; password: string; accountId: string };
export type SeededGame = {
  gameId: string;
  gm: SeededAccount;
  player: SeededAccount;
  membershipId: string;
  gmCharacterId: string;
  playerCharacterId: string;
  playerCharacterIds: string[];
  weaponId: string | null;
};

let counter = 0;
const unique = (label: string) => `${label}${++counter}${randomUUID().slice(0, 6)}`;

export async function seedPool() {
  const schema = inject("databaseSchema") as string;
  return new pg.Pool({
    connectionString: inject("databaseUrl") as string,
    options: `-c search_path=${schema}`,
  });
}

/** Creates a separate account for a scenario without any games. */
export async function seedAccount(): Promise<SeededAccount> {
  const pool = await seedPool();
  try {
    const username = unique("gm");
    const password = "password-123";
    const account = await registerAccount(databaseFromPool(pool), username, password);
    return { username, password, accountId: account.id };
  } finally {
    await pool.end();
  }
}

/** Seeds a Fabula Ultima game with a GM account, a player membership, and active characters. */
export async function seedGame(options: { gmWeapon?: "complete" | "incomplete" | "none"; playerCharacters?: number } = {}) {
  const pool = await seedPool();
  try {
    const gm: SeededAccount = { username: unique("gm"), password: "password-123", accountId: "" };
    const player: SeededAccount = { username: unique("player"), password: "password-123", accountId: "" };
    gm.accountId = (await registerAccount(databaseFromPool(pool), gm.username, gm.password)).id;
    player.accountId = (await registerAccount(databaseFromPool(pool), player.username, player.password)).id;
    const gmActor = { accountId: gm.accountId, sessionId: randomUUID() };
    const playerActor = { accountId: player.accountId, sessionId: randomUUID() };
    const game = await createActorGame(databaseFromPool(pool), gmActor, unique("Table"), "fabula-ultima");
    const gameId = game.id;
    const membershipId = randomUUID();
    await pool.query("INSERT INTO players(id,game_id,account_id,name) VALUES ($1,$2,$3,$4)", [
      membershipId,
      gameId,
      player.accountId,
      unique("member"),
    ]);
    const gmCharacterId = randomUUID();
    await createWorkspaceCharacter(databaseFromPool(pool), gmActor, gameId, gmCharacterId, unique("GM Hero"));
    await setGmCharacterActive(databaseFromPool(pool), gmActor, gameId, gmCharacterId, true);
    const playerCharacterIds: string[] = [];
    const playerCharacters = options.playerCharacters ?? 1;
    for (let index = 0; index < playerCharacters; index++) {
      const id = randomUUID();
      await createWorkspaceCharacter(databaseFromPool(pool), playerActor, gameId, id, unique(`Player Hero ${index + 1}`));
      playerCharacterIds.push(id);
    }
    const playerCharacterId = playerCharacterIds[0]!;
    await pool.query("UPDATE players SET active_character_id=$1 WHERE id=$2", [playerCharacterId, membershipId]);
    let weaponId: string | null = null;
    if (options.gmWeapon && options.gmWeapon !== "none") {
      const weapon = {
        id: randomUUID(),
        name: "Rapier",
        notes: "",
        priceZenit: null,
        kind: "weapon" as const,
        equipped: true,
        accuracyDice: options.gmWeapon === "complete" ? (["DEX", "INS"] as ["DEX", "INS"]) : (["DEX", null] as ["DEX", null]),
        accuracyBonus: options.gmWeapon === "complete" ? 1 : null,
      };
      const revision = Number(
        (await pool.query("SELECT revision FROM characters WHERE id=$1", [gmCharacterId])).rows[0]!.revision,
      );
      await updateWorkspaceCharacter(databaseFromPool(pool), gameId, gmActor, gmCharacterId, revision, { equipment: [weapon] });
      weaponId = weapon.id;
    }
    return { gameId, gm, player, membershipId, gmCharacterId, playerCharacterId, playerCharacterIds, weaponId };
  } finally {
    await pool.end();
  }
}

export async function setPlayerActiveCharacter(game: SeededGame, characterId: string | null) {
  const pool = await seedPool();
  try {
    await pool.query("UPDATE players SET active_character_id=$1 WHERE id=$2", [characterId, game.membershipId]);
  } finally {
    await pool.end();
  }
}
