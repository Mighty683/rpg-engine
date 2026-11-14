import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";
import type {
  EquipmentEntry,
  FabulaPreview,
  FabulaSheet,
} from "../../../backend/src/modules/fabula/types.ts";
import type { PartyCharacter } from "../../../backend/src/modules/characters/types.ts";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("API-MAP-01 character projection parity", () => {
  let fixture: ApiFixture;
  beforeAll(async () => {
    fixture = await createApiFixture("character_projections");
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  it("preserves equipment, ordering and overrides across sheet and party reads without writes", async () => {
    const { ids, request, pool } = fixture;
    const path = `/games/${ids.game}/characters/${ids.gmCharacter}`;
    const equipment: EquipmentEntry[] = [
      {
        id: randomUUID(),
        name: "Weapon",
        notes: "accuracy",
        priceZenit: 300,
        kind: "weapon",
        equipped: true,
        accuracyDice: ["DEX", "MIG"],
        accuracyBonus: -2,
      },
      {
        id: randomUUID(),
        name: "Armor",
        notes: "fixed",
        priceZenit: null,
        kind: "armor",
        equipped: true,
        fixedDefense: 12,
        defenseBonus: 0,
        magicDefenseBonus: 1,
        initiativeModifier: -2,
      },
      {
        id: randomUUID(),
        name: "Shield",
        notes: "bonus",
        priceZenit: 0,
        kind: "shield",
        equipped: true,
        defenseBonus: 2,
        magicDefenseBonus: 2,
        initiativeModifier: -1,
      },
      { id: randomUUID(), name: "Other", notes: "supplies", priceZenit: null, kind: "other" },
      {
        id: randomUUID(),
        name: "Incomplete weapon",
        notes: "manual",
        priceZenit: 5,
        kind: "weapon",
        equipped: false,
        accuracyDice: [null, "INS"],
        accuracyBonus: null,
      },
    ];
    const classes = [
      { id: randomUUID(), name: "Second alphabetically", notes: "first in sheet" },
      { id: randomUUID(), name: "First alphabetically", notes: "second in sheet" },
    ];
    const skills = [{ id: randomUUID(), name: "Skill", notes: "retain full-sheet data" }];
    const saved = await request(path, "gm", "PATCH", {
      expectedRevision: 0,
      changes: {
        baseDice: { DEX: 8, INS: 10, MIG: 6, WLP: 8 },
        resources: { hp: 25, mp: 7, ip: 3, fabula: 2 },
        overrides: {
          maxHp: 80,
          maxMp: 40,
          maxIp: 9,
          defense: 0,
          magicDefense: null,
          initiative: null,
        },
        equipment,
        classes,
        skills,
      },
    });
    expect(saved.status).toBe(200);
    const first = (await saved.json()).character;
    expect(first.sheet.equipment).toEqual(equipment);
    expect((await request(`${path}/active`, "gm", "PUT", { active: true })).status).toBe(200);

    const storedEquipment = () =>
      pool
        .query("SELECT * FROM character_equipment WHERE character_id=$1 ORDER BY position", [
          ids.gmCharacter,
        ])
        .then((result) => result.rows);
    const beforeReads = await storedEquipment();
    const fullResponse = await request(path, "gm");
    expect(fullResponse.status).toBe(200);
    const { character } = (await fullResponse.json()) as {
      character: { sheet: FabulaSheet; derived: FabulaPreview; revision: number };
    };
    expect(character.sheet.equipment).toEqual(equipment);
    expect(character.sheet.classes).toEqual(classes);
    expect(character.sheet.skills).toEqual(skills);
    expect(character.sheet.overrides).toMatchObject({ maxHp: 80, maxMp: 40, maxIp: 9, defense: 0 });
    expect(character.derived.defenses.defense.calculated).toBe(14);
    expect(character.derived.defenses.magicDefense.calculated).toBe(13);
    for (const viewer of ["gm", "player"]) {
      const response = await request(`/games/${ids.game}/party`, viewer);
      expect(response.status).toBe(200);
      const party = (await response.json()) as { characters: PartyCharacter[] };
      const projected = party.characters.find((entry) => entry.id === ids.gmCharacter)!;
      expect(projected).toMatchObject({
        id: ids.gmCharacter,
        revision: character.revision,
        classes: classes.map((entry) => entry.name),
        baseDice: character.sheet.baseDice,
        resources: character.sheet.resources,
        maxima: character.derived.maxima,
        defense: 0,
        magicDefense: 13,
        canRoll: viewer === "gm",
      });
      expect(projected.maxima).toEqual({ hp: 35, mp: 45, ip: 6 });
      expect(projected.weapons).toEqual([
        {
          id: equipment[0]!.id,
          name: "Weapon",
          equipped: true,
          accuracyDice: ["DEX", "MIG"],
          accuracyBonus: -2,
          ready: true,
        },
        {
          id: equipment[4]!.id,
          name: "Incomplete weapon",
          equipped: false,
          accuracyDice: [null, "INS"],
          accuracyBonus: null,
          ready: false,
        },
      ]);
    }
    expect(await storedEquipment()).toEqual(beforeReads);

    const changedKind: EquipmentEntry = {
      id: equipment[0]!.id,
      name: "Retired weapon",
      notes: "now supplies",
      kind: "other",
      priceZenit: null,
    };
    const replacement = [equipment[3]!, changedKind, equipment[2]!, equipment[1]!];
    const updated = await request(path, "gm", "PATCH", {
      expectedRevision: character.revision,
      changes: { equipment: replacement, overrides: { defense: null } },
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).character.sheet.equipment).toEqual(replacement);
    const afterUpdate = await storedEquipment();
    expect(afterUpdate.map((row) => row.id)).toEqual(replacement.map((entry) => entry.id));
    expect(afterUpdate.find((row) => row.id === changedKind.id)).toMatchObject({
      kind: "other",
      equipped: null,
      accuracy_attribute_1: null,
      accuracy_attribute_2: null,
      accuracy_bonus: null,
      fixed_defense: null,
      defense_bonus: null,
      magic_defense_bonus: null,
      initiative_modifier: null,
    });
    const reopened = await request(path, "gm");
    expect(reopened.status).toBe(200);
    expect((await reopened.json()).character.sheet).toMatchObject({
      equipment: replacement,
      classes,
      skills,
    });
    const partyAfterUpdate = await request(`/games/${ids.game}/party`, "player");
    expect(partyAfterUpdate.status).toBe(200);
    expect(
      (await partyAfterUpdate.json()).characters.find(
        (entry: PartyCharacter) => entry.id === ids.gmCharacter,
      ),
    ).toMatchObject({ defense: 14, magicDefense: 13, weapons: [] });
    expect(await storedEquipment()).toEqual(afterUpdate);
  });
});
