import { databaseFromPool } from "../../../backend/src/database/client.ts";
// Game Table API integration suite (handover API-02..API-05): active-party projection, throw
// access and attribution, roll validation with persisted-state checks, history pagination and
// rerolls, removal, and outcome structure. Dice faces are scripted through
// a mocked die source so fumble/critical/opposed outcomes are deterministic.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createSession } from "../../../backend/src/modules/auth/sessions.ts";
import { createWorkspaceCharacter } from "../../../backend/src/modules/characters/workspace-service.ts";
import type { SideOutcomeJson, ThrowRecord } from "../../../backend/src/modules/throws/contract.ts";
import { createApiFixture, readPersistedState, type ApiFixture } from "./fixtures.ts";

const dieScript = vi.hoisted(() => ({ faces: null as number[] | null }));

vi.mock("../../../backend/src/modules/fabula/rolls.ts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../backend/src/modules/fabula/rolls.ts")>();
  return {
    ...mod,
    serverDieSource: (sides: number) =>
      dieScript.faces && dieScript.faces.length > 0 ? dieScript.faces.shift()! : mod.serverDieSource(sides),
  };
});

type PartyWeaponJson = {
  id: string;
  name: string;
  equipped: boolean;
  ready: boolean;
  accuracyDice: (string | null)[];
  accuracyBonus: number | null;
};
type PartyCharacterJson = {
  id: string;
  name: string;
  revision: number;
  canRoll: boolean;
  weapons: PartyWeaponJson[];
};

describe("API game table throws", () => {
  let fixture: ApiFixture;

  beforeAll(async () => {
    fixture = await createApiFixture("game_table");
  });

  afterAll(async () => {
    await fixture?.cleanup();
  });

  beforeEach(async () => {
    const { pool, ids } = fixture;
    await pool.query("UPDATE characters SET gm_active=true,name='GM sheet',revision=0 WHERE id=$1", [ids.gmCharacter]);
    await pool.query("UPDATE characters SET player_id=$1,gm_active=false,name='Player sheet',revision=0 WHERE id=$2", [ids.member, ids.playerCharacter]);
    await pool.query("UPDATE players SET removed=false,active_character_id=$2,revision=1 WHERE id=$1", [ids.member, ids.playerCharacter]);
    await pool.query("DELETE FROM character_equipment WHERE character_id IN ($1,$2,$3)", [ids.gmCharacter, ids.playerCharacter, ids.foreignCharacter]);
    await pool.query("DELETE FROM throws WHERE game_id IN ($1,$2)", [ids.game, ids.otherGame]);
    dieScript.faces = null;
  });

  const getThrows = (actor: string | null, gameId: string, query = "") =>
    fixture.request(`/games/${gameId}/throws${query}`, actor);
  const getParty = (actor: string | null, gameId: string) => fixture.request(`/games/${gameId}/party`, actor);
  const postThrow = (actor: string | null, gameId: string, body: unknown) =>
    fixture.request(`/games/${gameId}/throws`, actor, "POST", body);
  const deleteThrow = (actor: string | null, gameId: string, throwId: string) =>
    fixture.request(`/games/${gameId}/throws/${throwId}`, actor, "DELETE");

  const freeSetup = (characterId: string, overrides: Record<string, unknown> = {}) => ({
    type: "free",
    characterId,
    dice: [8, 6],
    modifier: 0,
    redDice: [] as number[],
    redModifier: 0,
    note: "",
    ...overrides,
  });
  const attributeSetup = (characterId: string, expectedRevision: number, overrides: Record<string, unknown> = {}) => ({
    type: "attribute",
    characterId,
    expectedRevision,
    attributes: ["DEX", "INS"],
    dice: {},
    modifier: 0,
    redDice: [] as number[],
    redModifier: 0,
    note: "",
    ...overrides,
  });
  const weaponSetup = (characterId: string, equipmentId: string, expectedRevision: number, overrides: Record<string, unknown> = {}) => ({
    type: "weapon",
    characterId,
    equipmentId,
    expectedRevision,
    dice: [8, 10],
    modifier: 0,
    note: "",
    ...overrides,
  });
  const submit = (
    actor: string | null,
    gameId: string,
    setup: Record<string, unknown>,
    extra: { sourceThrowId?: string | null } = {},
  ) =>
    postThrow(actor, gameId, {
      sourceThrowId: extra.sourceThrowId ?? null,
      setup,
    });
  const createThrow = async (
    actor: string | null,
    gameId: string,
    setup: Record<string, unknown>,
    extra: { sourceThrowId?: string | null } = {},
  ) => {
    const response = await submit(actor, gameId, setup, extra);
    expect(response.status).toBe(201);
    return (await response.json()).throw as ThrowRecord;
  };

  const addWeapon = async (
    characterId: string,
    overrides: { name?: string; equipped?: boolean; a1?: string | null; a2?: string | null; bonus?: number | null } = {},
  ) => {
    const id = randomUUID();
    await fixture.pool.query(
      `INSERT INTO character_equipment(id,character_id,name,notes,position,kind,price_zenit,equipped,accuracy_attribute_1,accuracy_attribute_2,accuracy_bonus)
       VALUES ($1,$2,$3,'',(SELECT COALESCE(MAX(position),0)+1 FROM character_equipment WHERE character_id=$2),'weapon',null,$4,$5,$6,$7)`,
      [
        id,
        characterId,
        overrides.name ?? "Sword",
        overrides.equipped ?? true,
        overrides.a1 === undefined ? "DEX" : overrides.a1,
        overrides.a2 === undefined ? "INS" : overrides.a2,
        overrides.bonus === undefined ? 2 : overrides.bonus,
      ],
    );
    return id;
  };

  const addGameMember = async (name: string) => {
    const accountId = randomUUID();
    const membershipId = randomUUID();
    await fixture.pool.query("INSERT INTO accounts(id,username,password_hash) VALUES ($1,$2,'hash')", [accountId, name]);
    await fixture.pool.query("INSERT INTO players(id,game_id,account_id,name) VALUES ($1,$2,$3,$4)", [
      membershipId,
      fixture.ids.game,
      accountId,
      name,
    ]);
    const session = await createSession(databaseFromPool(fixture.pool), accountId, new Date(Date.now() + 60_000));
    return { accountId, membershipId, sessionId: session.sessionId, token: session.token };
  };

  const throwCount = async (gameId: string, includeDeleted = false) =>
    Number(
      (
        await fixture.pool.query(
          `SELECT count(*)::int AS c FROM throws WHERE game_id=$1${includeDeleted ? "" : " AND NOT deleted"}`,
          [gameId],
        )
      ).rows[0]!.c,
    );
  const listThrows = async (actor: string | null, gameId: string, query = "") =>
    ((await (await getThrows(actor, gameId, query)).json()).throws as ThrowRecord[]);

  const classify = (a: number, b: number) => (a === 1 && b === 1 ? "fumble" : a === b && a >= 6 ? "critical" : "ordinary");
  const checkKinds = new Set(["attribute-check", "weapon-accuracy", "opposed-check"]);
  const expectConsistentOutcome = (record: ThrowRecord) => {
    const sides = [record.outcome.first, record.outcome.second].filter((side): side is SideOutcomeJson => side !== undefined);
    for (const side of sides) {
      expect(side.total).toBe(side.dice.reduce((sum, die) => sum + die.face, side.modifier));
      expect(side.result).toBe(
        checkKinds.has(record.kind) && side.dice.length === 2 ? classify(side.dice[0]!.face, side.dice[1]!.face) : "none",
      );
    }
    if (record.outcome.winner) {
      const rank = (side: NonNullable<ThrowRecord["outcome"]["second"]>) =>
        side.result === "critical" ? Number.POSITIVE_INFINITY : side.result === "fumble" ? Number.NEGATIVE_INFINITY : side.total;
      const first = rank(record.outcome.first);
      const second = rank(record.outcome.second!);
      expect(record.outcome.winner).toBe(first === second ? "tie" : first > second ? "first" : "second");
    }
  };

  it("API-02: guards party and history by session, game access, and membership, and projects the active party", async () => {
    const { ids, request } = fixture;
    const anonymous: [string, string, unknown?][] = [
      ["GET", `/games/${ids.game}/party`],
      ["GET", `/games/${ids.game}/throws`],
      ["POST", `/games/${ids.game}/throws`, { sourceThrowId: null, setup: freeSetup("gm") }],
      ["DELETE", `/games/${ids.game}/throws/${randomUUID()}`],
    ];
    for (const [method, path, body] of anonymous)
      expect((await request(path, null, method, body)).status, `${method} ${path}`).toBe(401);

    for (const [method, path, body] of [
      ["GET", `/games/${ids.game}/party`],
      ["GET", `/games/${ids.game}/throws`],
      ["POST", `/games/${ids.game}/throws`, { sourceThrowId: null, setup: freeSetup("gm") }],
      ["DELETE", `/games/${ids.game}/throws/${randomUUID()}`],
    ] as [string, string, unknown?][])
      expect((await request(path, "outsider", method, body)).status, `${method} ${path}`).toBe(404);
    expect((await getThrows("gm", ids.otherGame)).status).toBe(404);
    expect((await postThrow("gm", ids.otherGame, { sourceThrowId: null, setup: freeSetup("gm") })).status).toBe(404);

    const readyWeapon = await addWeapon(ids.playerCharacter);
    const dullWeapon = await addWeapon(ids.playerCharacter, { name: "Dull", a2: null, bonus: null });
    const gmParty = ((await (await getParty("gm", ids.game)).json()).characters as PartyCharacterJson[]);
    expect(gmParty.map((entry) => entry.id).sort()).toEqual([ids.gmCharacter, ids.playerCharacter].sort());
    expect(gmParty.every((entry) => entry.canRoll)).toBe(true);
    const playerCard = gmParty.find((entry) => entry.id === ids.playerCharacter)!;
    expect(playerCard.weapons).toHaveLength(2);
    expect(playerCard.weapons.find((weapon) => weapon.id === readyWeapon)).toMatchObject({
      name: "Sword",
      ready: true,
      accuracyDice: ["DEX", "INS"],
      accuracyBonus: 2,
    });
    expect(playerCard.weapons.find((weapon) => weapon.id === dullWeapon)!.ready).toBe(false);

    const playerParty = ((await (await getParty("player", ids.game)).json()).characters as PartyCharacterJson[]);
    expect(playerParty.find((entry) => entry.id === ids.playerCharacter)!.canRoll).toBe(true);
    expect(playerParty.find((entry) => entry.id === ids.gmCharacter)!.canRoll).toBe(false);

    expect((await request(`/games/${ids.game}/characters/${ids.gmCharacter}/active`, "gm", "PUT", { active: false })).status).toBe(200);
    const afterDeactivate = (await (await getParty("gm", ids.game)).json()).characters as PartyCharacterJson[];
    expect(afterDeactivate.map((entry) => entry.id)).toEqual([ids.playerCharacter]);

    expect((await request(`/games/${ids.game}/members/${ids.member}/remove`, "gm", "POST")).status).toBe(200);
    expect((await getThrows("player", ids.game)).status).toBe(404);
    expect((await submit("player", ids.game, freeSetup(ids.playerCharacter))).status).toBe(404);
    expect((await deleteThrow("player", ids.game, randomUUID())).status).toBe(404);
    expect((await getParty("player", ids.game)).status).toBe(404);
    expect((await request(`/games/${ids.game}/members/${ids.member}/restore`, "gm", "POST")).status).toBe(200);
    expect((await getThrows("player", ids.game)).status).toBe(200);
    expect(await throwCount(ids.game)).toBe(0);
  });

  it("API-02: attributes rolls to the submitting account and rejects foreign or cross-game selections", async () => {
    const { ids } = fixture;
    dieScript.faces = [5, 3];
    const gmRoll = await createThrow("gm", ids.game, freeSetup("gm", { modifier: 2, note: "gm free" }));
    expect(gmRoll).toMatchObject({ kind: "free", role: "GM", characterId: null, characterName: "GM", seq: 1, canRemove: true });
    expect(gmRoll.outcome.first.total).toBe(10);
    expect(gmRoll.outcome.first.result).toBe("none");
    expectConsistentOutcome(gmRoll);

    const playerView = await listThrows("player", ids.game);
    expect(playerView).toHaveLength(1);
    expect(playerView[0]!.role).toBe("GM");
    expect(playerView[0]!.canRemove).toBe(false);
    expect((await deleteThrow("player", ids.game, gmRoll.id)).status).toBe(403);

    const asPlayerCharacter = await createThrow("gm", ids.game, freeSetup(ids.playerCharacter, { note: "gm as pc" }));
    expect(asPlayerCharacter).toMatchObject({ role: "GM", characterId: ids.playerCharacter, characterName: "Player sheet" });
    expect((await deleteThrow("player", ids.game, asPlayerCharacter.id)).status).toBe(403);
    const gmView = await listThrows("gm", ids.game);
    expect(gmView.find((entry) => entry.id === asPlayerCharacter.id)!.canRemove).toBe(true);

    const own = await createThrow("player", ids.game, freeSetup(ids.playerCharacter));
    expect(own).toMatchObject({ role: "Player", characterId: ids.playerCharacter, characterName: "Player sheet", canRemove: true });
    expect((await listThrows("gm", ids.game)).find((entry) => entry.id === own.id)!.role).toBe("Player");

    expect((await submit("player", ids.game, freeSetup("gm"))).status).toBe(403);
    const notOwnActive = await submit("player", ids.game, freeSetup(ids.gmCharacter));
    expect(notOwnActive.status).toBe(409);
    expect((await notOwnActive.json()).error.code).toBe("no_active_character");
    expect((await submit("player", ids.game, attributeSetup(ids.gmCharacter, 0))).status).toBe(403);
    expect((await submit("player", ids.game, attributeSetup(ids.foreignCharacter, 0))).status).toBe(404);
    expect((await submit("gm", ids.game, freeSetup(ids.foreignCharacter))).status).toBe(404);
    expect((await submit("gm", ids.game, attributeSetup(ids.foreignCharacter, 0))).status).toBe(404);
    expect(await throwCount(ids.game)).toBe(3);
  });

  it("API-02: verifies the player's active character at submission time", async () => {
    const { ids, pool, request } = fixture;
    await pool.query("UPDATE players SET active_character_id=NULL WHERE id=$1", [ids.member]);
    const before = await readPersistedState(fixture);
    const missing = await submit("player", ids.game, freeSetup(ids.playerCharacter));
    expect(missing.status).toBe(409);
    expect((await missing.json()).error.code).toBe("no_active_character");
    expect(await throwCount(ids.game)).toBe(0);
    expect(await readPersistedState(fixture)).toEqual(before);

    const inactiveForGm = await submit("gm", ids.game, freeSetup(ids.playerCharacter));
    expect(inactiveForGm.status).toBe(409);
    expect((await inactiveForGm.json()).error.code).toBe("inactive_character");

    const select = await request(`/games/${ids.game}/active-character`, "player", "PUT", {
      characterId: ids.playerCharacter,
      expectedRevision: 1,
    });
    expect(select.status).toBe(200);
    const roll = await createThrow("player", ids.game, freeSetup(ids.playerCharacter));
    expect(roll).toMatchObject({ role: "Player", characterId: ids.playerCharacter, characterName: "Player sheet" });
    expect(await throwCount(ids.game)).toBe(1);
  });

  it("API-03: rejects stale revisions and selections invalidated by completed changes", async () => {
    const { ids, request } = fixture;
    const stale = await submit("gm", ids.game, attributeSetup(ids.gmCharacter, 7));
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe("stale_revision");
    expect(await throwCount(ids.game)).toBe(0);

    expect(
      (await request(`/games/${ids.game}/characters/${ids.gmCharacter}`, "gm", "PATCH", { expectedRevision: 0, changes: { theme: "storm" } })).status,
    ).toBe(200);
    const afterSheetChange = await submit("gm", ids.game, attributeSetup(ids.gmCharacter, 0));
    expect(afterSheetChange.status).toBe(409);
    expect((await afterSheetChange.json()).error.code).toBe("stale_revision");
    expect(await throwCount(ids.game)).toBe(0);
    const fresh = await createThrow("gm", ids.game, attributeSetup(ids.gmCharacter, 1));
    expect(fresh.seq).toBe(1);

    expect((await request(`/games/${ids.game}/characters/${ids.gmCharacter}/active`, "gm", "PUT", { active: false })).status).toBe(200);
    const stateBefore = await readPersistedState(fixture);
    const deactivated = await submit("gm", ids.game, attributeSetup(ids.gmCharacter, 1));
    expect(deactivated.status).toBe(409);
    expect((await deactivated.json()).error.code).toBe("inactive_character");
    expect(await throwCount(ids.game)).toBe(1);
    expect(await readPersistedState(fixture)).toEqual(stateBefore);
    expect((await request(`/games/${ids.game}/characters/${ids.gmCharacter}/active`, "gm", "PUT", { active: true })).status).toBe(200);

    expect(
      (await request(`/games/${ids.game}/characters/${ids.playerCharacter}/controller`, "gm", "PATCH", { membershipId: null })).status,
    ).toBe(200);
    const reassigned = await submit("player", ids.game, freeSetup(ids.playerCharacter));
    expect(reassigned.status).toBe(409);
    expect((await reassigned.json()).error.code).toBe("no_active_character");
    const gmOnReassigned = await submit("gm", ids.game, freeSetup(ids.playerCharacter));
    expect(gmOnReassigned.status).toBe(409);
    expect((await gmOnReassigned.json()).error.code).toBe("inactive_character");
    expect(await throwCount(ids.game)).toBe(1);

    expect((await request(`/games/${ids.game}/members/${ids.member}/remove`, "gm", "POST")).status).toBe(200);
    expect((await submit("player", ids.game, freeSetup(ids.playerCharacter))).status).toBe(404);
    expect((await getThrows("player", ids.game)).status).toBe(404);
    expect(await throwCount(ids.game)).toBe(1);
  });

  it("API-03: rejects malformed pools, out-of-range modifiers, bad weapons, and forged authoritative fields", async () => {
    const { ids } = fixture;
    const stateBefore = await readPersistedState(fixture);
    const weaponId = await addWeapon(ids.gmCharacter);
    const incompleteWeapon = await addWeapon(ids.gmCharacter, { name: "Dull", a2: null, bonus: null });
    const foreignWeapon = await addWeapon(ids.foreignCharacter);

    const rejected: [Promise<Response>, number][] = [
      [submit("gm", ids.game, freeSetup("gm", { redDice: [6, 8, 10] })), 422],
      [submit("gm", ids.game, freeSetup("gm", { dice: [6, 8, 10] })), 422],
      [submit("gm", ids.game, attributeSetup(ids.gmCharacter, 0, { redDice: [4, 6] })), 422],
      [submit("gm", ids.game, freeSetup("gm", { modifier: 2147483648 })), 422],
      [submit("gm", ids.game, freeSetup("gm", { redModifier: -2147483649 })), 422],
      [submit("gm", ids.game, weaponSetup(ids.gmCharacter, weaponId, 0, { dice: [4, 6] })), 422],
      [submit("gm", ids.game, weaponSetup(ids.gmCharacter, weaponId, 0, { dice: [8] })), 422],
      [submit("gm", ids.game, freeSetup("gm", { faces: [1, 1] })), 422],
      [submit("gm", ids.game, freeSetup("gm", { totals: 99 })), 422],
      [submit("gm", ids.game, weaponSetup(ids.gmCharacter, weaponId, 0, { weaponBonus: 9 })), 422],
      [submit("gm", ids.game, attributeSetup(ids.gmCharacter, 0, { role: "GM", characterName: "forged" })), 422],
      [postThrow("gm", ids.game, { sourceThrowId: null, setup: freeSetup("gm"), outcome: { first: {} } }), 422],
      [postThrow("gm", ids.game, "nope"), 400],
      [submit("gm", ids.game, weaponSetup(ids.gmCharacter, randomUUID(), 0)), 404],
      [submit("gm", ids.game, weaponSetup(ids.gmCharacter, foreignWeapon, 0)), 404],
      [submit("gm", ids.game, weaponSetup(ids.gmCharacter, incompleteWeapon, 0)), 422],
    ];
    for (const [attempt, status] of rejected) {
      const response = await attempt;
      expect(response.status, JSON.stringify(await response.clone().json().catch(() => null))).toBe(status);
    }
    const validationError = await submit("gm", ids.game, freeSetup("gm", { faces: [1, 1] }));
    expect((await validationError.json()).error.code).toBe("validation");

    const singleDie = await createThrow("gm", ids.game, freeSetup("gm", { dice: [8] }));
    expect(singleDie.kind).toBe("free");
    const wideFree = await createThrow("gm", ids.game, freeSetup("gm", { dice: [4, 20] }));
    expect(wideFree.kind).toBe("free");
    dieScript.faces = [3];
    const bigModifier = await createThrow("gm", ids.game, freeSetup("gm", { dice: [8], modifier: 2147483647 }));
    expect(bigModifier.outcome.first.total).toBe(2147483650);
    const weapon = await createThrow("gm", ids.game, weaponSetup(ids.gmCharacter, weaponId, 0));
    expect(weapon.kind).toBe("weapon-accuracy");

    expect(await throwCount(ids.game)).toBe(4);
    expect(await readPersistedState(fixture)).toEqual(stateBefore);
  });

  it("API-04: pages history with a stable cursor", async () => {
    const { ids } = fixture;
    const firstSetup = freeSetup("gm", { note: "roll 0" });
    const first = await createThrow("gm", ids.game, firstSetup);
    const rest: ThrowRecord[] = [];
    for (let index = 1; index < 5; index++)
      rest.push(await createThrow("gm", ids.game, freeSetup("gm", { note: `roll ${index}` })));

    const all = await listThrows("gm", ids.game);
    expect(all.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(all.map((entry) => entry.id)).toEqual([first, ...rest].map((entry) => entry.id));

    const page = async (query: string) => listThrows("gm", ids.game, query);
    const page1 = await page("?limit=2");
    const page2 = await page("?before=4&limit=2");
    const page3 = await page("?before=2&limit=2");
    const page4 = await page("?before=1&limit=2");
    expect(page1.map((entry) => entry.seq)).toEqual([4, 5]);
    expect(page2.map((entry) => entry.seq)).toEqual([2, 3]);
    expect(page3.map((entry) => entry.seq)).toEqual([1]);
    expect(page4).toEqual([]);
    const paged = [...page1, ...page2, ...page3];
    expect(new Set(paged.map((entry) => entry.id)).size).toBe(5);
    expect(paged.map((entry) => entry.id).sort()).toEqual(all.map((entry) => entry.id).sort());

    expect((await deleteThrow("gm", ids.game, rest[3]!.id)).status).toBe(200);
    const repeated = await createThrow("gm", ids.game, firstSetup);
    expect(repeated.id).not.toBe(first.id);
    expect(repeated.seq).toBe(6);
    expect((await listThrows("gm", ids.game)).map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 6]);
  });

  it("API-04: keeps historical attribution and setup intact after character and weapon renames", async () => {
    const { ids, request } = fixture;
    const weaponId = await addWeapon(ids.playerCharacter);
    const freeThrow = await createThrow("player", ids.game, freeSetup(ids.playerCharacter, { note: "orig" }));
    const weaponThrow = await createThrow("player", ids.game, weaponSetup(ids.playerCharacter, weaponId, 0));
    expect(weaponThrow.equipmentName).toBe("Sword");

    expect(
      (await request(`/games/${ids.game}/characters/${ids.playerCharacter}`, "gm", "PATCH", { expectedRevision: 0, changes: { name: "Renamed Hero" } })).status,
    ).toBe(200);
    const sheet = (await (await request(`/games/${ids.game}/characters/${ids.playerCharacter}`, "player")).json()).character;
    const renamedEquipment = sheet.sheet.equipment.map((entry: { id: string }) =>
      entry.id === weaponId ? { ...entry, name: "Blade" } : entry,
    );
    expect(
      (await request(`/games/${ids.game}/characters/${ids.playerCharacter}`, "player", "PATCH", {
        expectedRevision: 1,
        changes: { equipment: renamedEquipment },
      })).status,
    ).toBe(200);

    const history = await listThrows("gm", ids.game);
    const oldFree = history.find((entry) => entry.id === freeThrow.id)!;
    const oldWeapon = history.find((entry) => entry.id === weaponThrow.id)!;
    expect(oldFree.characterName).toBe("Player sheet");
    expect(oldFree.setup).toEqual(freeThrow.setup);
    expect(oldWeapon.characterName).toBe("Player sheet");
    expect(oldWeapon.equipmentName).toBe("Sword");
    expect(oldWeapon.setup).toEqual(weaponThrow.setup);

    const after = await createThrow("player", ids.game, freeSetup(ids.playerCharacter));
    expect(after.characterName).toBe("Renamed Hero");
    const newWeaponThrow = await createThrow("player", ids.game, weaponSetup(ids.playerCharacter, weaponId, 2));
    expect(newWeaponThrow.equipmentName).toBe("Blade");
  });

  it("API-05: scopes reroll sources to the game and keeps the saved weapon recipe", async () => {
    const { ids, request } = fixture;
    const weaponId = await addWeapon(ids.gmCharacter);
    const source = await createThrow("gm", ids.game, weaponSetup(ids.gmCharacter, weaponId, 0, { note: "first" }));
    expect(source.kind).toBe("weapon-accuracy");
    expect(source.setup.accuracyDice).toEqual(["DEX", "INS"]);
    expect(source.setup.weaponBonus).toBe(2);

    const sheet = (await (await request(`/games/${ids.game}/characters/${ids.gmCharacter}`, "gm")).json()).character;
    const changedEquipment = sheet.sheet.equipment.map((entry: { id: string }) =>
      entry.id === weaponId ? { ...entry, name: "Blade", accuracyDice: ["MIG", "WLP"], accuracyBonus: 5 } : entry,
    );
    expect(
      (await request(`/games/${ids.game}/characters/${ids.gmCharacter}`, "gm", "PATCH", { expectedRevision: 0, changes: { equipment: changedEquipment } })).status,
    ).toBe(200);

    dieScript.faces = [6, 6];
    const reroll = await createThrow(
      "gm",
      ids.game,
      weaponSetup(ids.gmCharacter, weaponId, 1, { dice: [6, 6], note: "reroll" }),
      { sourceThrowId: source.id },
    );
    expect(reroll.id).not.toBe(source.id);
    expect(reroll.seq).toBe(2);
    expect(reroll.setup.accuracyDice).toEqual(["DEX", "INS"]);
    expect(reroll.setup.weaponBonus).toBe(2);
    expect(reroll.outcome.first.result).toBe("critical");
    expect(reroll.outcome.first.total).toBe(6 + 6 + 0 + 2);
    expectConsistentOutcome(reroll);

    const history = await listThrows("gm", ids.game);
    expect(history).toHaveLength(2);
    expect(history.find((entry) => entry.id === source.id)!.setup).toEqual(source.setup);

    expect((await submit("gm", ids.game, freeSetup("gm"), { sourceThrowId: source.id })).status).toBe(422);
    const otherSource = await createThrow("outsider", ids.otherGame, freeSetup("gm"));
    expect((await submit("gm", ids.game, freeSetup("gm"), { sourceThrowId: otherSource.id })).status).toBe(404);
    expect((await submit("gm", ids.game, freeSetup("gm"), { sourceThrowId: randomUUID() })).status).toBe(404);
    const deletedSource = await createThrow("gm", ids.game, freeSetup("gm"));
    expect((await deleteThrow("gm", ids.game, deletedSource.id)).status).toBe(200);
    expect((await submit("gm", ids.game, freeSetup("gm"), { sourceThrowId: deletedSource.id })).status).toBe(404);

    const attrSource = await createThrow("gm", ids.game, attributeSetup(ids.gmCharacter, 1));
    const attrReroll = await createThrow("gm", ids.game, attributeSetup(ids.gmCharacter, 1, { note: "again" }), { sourceThrowId: attrSource.id });
    expect(attrReroll.characterId).toBe(ids.gmCharacter);
    expect((await submit("gm", ids.game, attributeSetup(ids.playerCharacter, 0), { sourceThrowId: attrSource.id })).status).toBe(422);

    const pcSource = await createThrow("gm", ids.game, freeSetup(ids.playerCharacter));
    const pcReroll = await createThrow("gm", ids.game, freeSetup(ids.playerCharacter, { note: "again" }), { sourceThrowId: pcSource.id });
    expect(pcReroll).toMatchObject({ role: "GM", characterId: ids.playerCharacter });
    const freeSource = await createThrow("gm", ids.game, freeSetup("gm"));
    const freeReroll = await createThrow("gm", ids.game, freeSetup("gm", { note: "again" }), { sourceThrowId: freeSource.id });
    expect(freeReroll).toMatchObject({ role: "GM", characterId: null, characterName: "GM" });
    expect(await throwCount(ids.game)).toBe(8);
    expect(await throwCount(ids.game, true)).toBe(9);
  });

  it("API-05: removal follows authorship and current game access", async () => {
    const { ids } = fixture;
    const second = await addGameMember("player2");
    const secondCharacter = randomUUID();
    await createWorkspaceCharacter(databaseFromPool(fixture.pool), { accountId: second.accountId, sessionId: second.sessionId }, ids.game, secondCharacter, "Second sheet");

    const own = await createThrow("player", ids.game, freeSetup(ids.playerCharacter));
    const other = await createThrow(second.token, ids.game, freeSetup(secondCharacter));
    expect(other).toMatchObject({ role: "Player", characterId: secondCharacter });
    const gmEntry = await createThrow("gm", ids.game, freeSetup("gm"));
    const foreignThrow = await createThrow("outsider", ids.otherGame, freeSetup("gm"));

    expect((await deleteThrow("player", ids.game, own.id)).status).toBe(200);
    expect((await deleteThrow("player", ids.game, own.id)).status).toBe(200);
    expect((await deleteThrow("player", ids.game, other.id)).status).toBe(403);
    expect((await deleteThrow("player", ids.game, gmEntry.id)).status).toBe(403);
    expect((await deleteThrow(second.token, ids.game, other.id)).status).toBe(200);
    expect((await deleteThrow("gm", ids.game, gmEntry.id)).status).toBe(200);
    expect((await deleteThrow("gm", ids.game, randomUUID())).status).toBe(404);
    expect((await deleteThrow("gm", ids.game, foreignThrow.id)).status).toBe(404);
    expect((await deleteThrow("outsider", ids.game, randomUUID())).status).toBe(404);

    expect(await listThrows("gm", ids.game)).toEqual([]);
    expect(await throwCount(ids.game)).toBe(0);
    expect(await throwCount(ids.game, true)).toBe(3);
  });

  it("API-05: outcome totals, classification, and opposed winners follow the rolled faces", async () => {
    const { ids } = fixture;
    dieScript.faces = [1, 1];
    const fumble = await createThrow("gm", ids.game, attributeSetup(ids.gmCharacter, 0, { modifier: 3 }));
    expect(fumble.kind).toBe("attribute-check");
    expect(fumble.outcome.first.result).toBe("fumble");
    expect(fumble.outcome.first.total).toBe(1 + 1 + 3);

    dieScript.faces = [6, 6];
    const critical = await createThrow("gm", ids.game, attributeSetup(ids.gmCharacter, 0));
    expect(critical.outcome.first.result).toBe("critical");
    expect(critical.outcome.first.total).toBe(12);

    dieScript.faces = [5, 4];
    const ordinary = await createThrow("gm", ids.game, attributeSetup(ids.gmCharacter, 0, { modifier: 2 }));
    expect(ordinary.outcome.first.result).toBe("ordinary");
    expect(ordinary.outcome.first.total).toBe(11);

    dieScript.faces = [7];
    const single = await createThrow("gm", ids.game, attributeSetup(ids.gmCharacter, 0, { attributes: ["WLP"], dice: { WLP: 8 } }));
    expect(single.kind).toBe("attribute-roll");
    expect(single.outcome.first.result).toBe("none");
    expect(single.outcome.first.total).toBe(7);

    const weaponId = await addWeapon(ids.gmCharacter, { bonus: 2 });
    dieScript.faces = [8, 8];
    const weapon = await createThrow("gm", ids.game, weaponSetup(ids.gmCharacter, weaponId, 0, { modifier: 1 }));
    expect(weapon.outcome.first.result).toBe("critical");
    expect(weapon.outcome.first.modifier).toBe(3);
    expect(weapon.outcome.first.total).toBe(19);

    dieScript.faces = [6, 6, 1, 1];
    const opposed = await createThrow("gm", ids.game, freeSetup("gm", { dice: [6, 6], redDice: [6, 6] }));
    expect(opposed.kind).toBe("opposed-check");
    expect(opposed.outcome.first.result).toBe("critical");
    expect(opposed.outcome.second!.result).toBe("fumble");
    expect(opposed.outcome.winner).toBe("first");

    dieScript.faces = [5, 4, 9];
    const uneven = await createThrow("gm", ids.game, attributeSetup(ids.gmCharacter, 0, { redDice: [12] }));
    expect(uneven.kind).toBe("opposed-roll");
    expect(uneven.setup.redDice).toEqual([{ label: "d12", size: 12 }]);
    expect(uneven.outcome.second).toMatchObject({ total: 9, result: "none" });

    dieScript.faces = [5, 4, 10, 11];
    const different = await createThrow("gm", ids.game, attributeSetup(ids.gmCharacter, 0, { redDice: [10, 12] }));
    expect(different.kind).toBe("opposed-check");
    expect(different.setup.redDice.map((die) => die.size)).toEqual([10, 12]);

    dieScript.faces = [4, 3, 5, 2];
    const tie = await createThrow("gm", ids.game, freeSetup("gm", { dice: [6, 6], redDice: [6, 6] }));
    expect(tie.outcome.first.result).toBe("ordinary");
    expect(tie.outcome.second!.result).toBe("ordinary");
    expect(tie.outcome.winner).toBe("tie");

    dieScript.faces = [4, 4, 3, 2];
    const win = await createThrow("gm", ids.game, freeSetup("gm", { dice: [6, 6], redDice: [6, 6] }));
    expect(win.outcome.winner).toBe("first");

    dieScript.faces = [8, 5, 4];
    const generic = await createThrow(
      "gm",
      ids.game,
      attributeSetup(ids.gmCharacter, 0, { attributes: ["DEX"], dice: { DEX: 8 }, redDice: [6, 6], modifier: 1, redModifier: 2 }),
    );
    expect(generic.kind).toBe("opposed-roll");
    expect(generic.outcome.first.result).toBe("none");
    expect(generic.outcome.second!.result).toBe("none");
    expect(generic.outcome.first.total).toBe(9);
    expect(generic.outcome.second!.total).toBe(11);
    expect(generic.outcome.winner).toBe("second");

    for (const entry of await listThrows("gm", ids.game)) expectConsistentOutcome(entry);
  });
});
