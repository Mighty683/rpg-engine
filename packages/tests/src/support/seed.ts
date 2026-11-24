import type { ClassDefinition } from "../../../backend/src/modules/class-catalog/types.ts";
import { createClassCatalogService } from "../../../backend/src/modules/class-catalog/service.ts";
import { createMembershipOwnership } from "../../../backend/src/modules/players/ownership.ts";
import { createGameAccessService } from "../../../backend/src/modules/games/service.ts";
import { createGameEvents } from "../../../backend/src/modules/events/streams.ts";
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
    options: `-c search_path=${schema},public`,
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

/** Adds a player with their own roster and selects the first character. */
export async function seedMember(
  pool: pg.Pool,
  gameId: string,
  player: SeededAccount,
  characterNames: string[],
) {
  const playerActor = { accountId: player.accountId, sessionId: randomUUID() };
  const membershipId = randomUUID();
  await pool.query("INSERT INTO players(id,game_id,account_id,name) VALUES ($1,$2,$3,$4)", [
    membershipId,
    gameId,
    player.accountId,
    unique("member"),
  ]);
  const playerCharacterIds: string[] = [];
  for (const name of characterNames) {
    const id = randomUUID();
    await createWorkspaceCharacter(
      {
        membershipsFor: createMembershipOwnership,
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool),
      },
      playerActor,
      gameId,
      id,
      name,
    );
    playerCharacterIds.push(id);
  }
  const playerCharacterId = playerCharacterIds[0]!;
  await pool.query("UPDATE players SET active_character_id=$1 WHERE id=$2", [
    playerCharacterId,
    membershipId,
  ]);
  return { membershipId, playerCharacterIds, playerCharacterId };
}

/** Seeds a Fabula Ultima game with a GM account, a player membership, and active characters. */
export async function seedGame(
  options: {
    gmWeapon?: "complete" | "incomplete" | "none";
    playerCharacters?: number;
    name?: string;
    gmName?: string;
    playerName?: string;
    player?: SeededAccount;
  } = {},
) {
  const pool = await seedPool();
  try {
    const gm = await seedAccount();
    const player = options.player ?? (await seedAccount());
    const gmActor = { accountId: gm.accountId, sessionId: randomUUID() };
    const game = await createActorGame(
      databaseFromPool(pool),
      gmActor,
      options.name ?? unique("Table"),
      "fabula-ultima",
    );
    const gameId = game.id;
    const gmCharacterId = randomUUID();
    await createWorkspaceCharacter(
      {
        membershipsFor: createMembershipOwnership,
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool),
      },
      gmActor,
      gameId,
      gmCharacterId,
      options.gmName ?? unique("GM Hero"),
    );
    await setGmCharacterActive(
      {
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool),
      },
      gmActor,
      gameId,
      gmCharacterId,
      true,
    );
    const names = options.playerName
      ? [options.playerName]
      : Array.from({ length: options.playerCharacters ?? 1 }, (_, i) =>
          unique(`Player Hero ${i + 1}`),
        );
    const { membershipId, playerCharacterId, playerCharacterIds } = await seedMember(
      pool,
      gameId,
      player,
      names,
    );
    let weaponId: string | null = null;
    if (options.gmWeapon && options.gmWeapon !== "none") {
      const weapon = {
        id: randomUUID(),
        name: "Rapier",
        notes: "",
        priceZenit: null,
        kind: "weapon" as const,
        equipped: true,
        accuracyDice:
          options.gmWeapon === "complete"
            ? (["DEX", "INS"] as ["DEX", "INS"])
            : (["DEX", null] as ["DEX", null]),
        accuracyBonus: options.gmWeapon === "complete" ? 1 : null,
      };
      const revision = Number(
        (await pool.query("SELECT revision FROM characters WHERE id=$1", [gmCharacterId])).rows[0]!
          .revision,
      );
      await updateWorkspaceCharacter(
        {
          gameAccessFor: createGameAccessService,
          events: createGameEvents(),
          database: databaseFromPool(pool),
        },
        gameId,
        gmActor,
        gmCharacterId,
        revision,
        { equipment: [weapon] },
      );
      weaponId = weapon.id;
    }
    return {
      gameId,
      gm,
      player,
      membershipId,
      gmCharacterId,
      playerCharacterId,
      playerCharacterIds,
      weaponId,
    };
  } finally {
    await pool.end();
  }
}

export async function setPlayerActiveCharacter(game: SeededGame, characterId: string | null) {
  const pool = await seedPool();
  try {
    await pool.query("UPDATE players SET active_character_id=$1 WHERE id=$2", [
      characterId,
      game.membershipId,
    ]);
  } finally {
    await pool.end();
  }
}

/** Installs a game copy through the catalog service, preserving the generated child identities. */
export async function seedGameClass(game: SeededGame, definition: ClassDefinition) {
  const pool = await seedPool();
  try {
    const catalog = createClassCatalogService({
      database: databaseFromPool(pool),
      gameAccessFor: createGameAccessService,
      events: createGameEvents(),
    });
    const gm = { accountId: game.gm.accountId, sessionId: randomUUID() };
    const template = await catalog.createTemplate(gm, {
      id: randomUUID(),
      systemId: "fabula-ultima",
      definition,
    });
    return (
      await catalog.copyClass(gm, game.gameId, {
        id: randomUUID(),
        templateId: template.record.id,
        expectedTemplateRevision: template.record.revision,
      })
    ).record;
  } finally {
    await pool.end();
  }
}
