import { agentTurnInputSchema } from "./modules/agent/schema.ts";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";
import { structuralSchema, type Schema } from "../openapi/schema-parity.ts";
import { credentialsSchema, credentialTextSchema } from "./modules/auth/schema.ts";
import { gameSchema } from "./modules/games/schema.ts";
import * as character from "./modules/characters/schema.ts";
import { activeCharacterSchema } from "./modules/players/schema.ts";
import * as invitation from "./modules/invitations/schema.ts";
import * as npc from "./modules/npcs/schema.ts";
import * as catalog from "./modules/class-catalog/schema.ts";
import * as roll from "./modules/throws/schema.ts";
import { uuidSchema } from "./shared/validation/schema.ts";
import { systems } from "./modules/rpg-systems/catalog.ts";

type Operation = {
  operationId?: string;
  requestBody?: { required?: boolean; content: { "application/json": { schema: Schema } } };
  parameters?: { name: string; schema: Schema }[];
};
const document = parse(
  readFileSync(new URL("../openapi/openapi.yaml", import.meta.url), "utf8"),
) as {
  components: { schemas: Record<string, Schema>; parameters: Record<string, { schema: Schema }> };
  paths: Record<string, Record<string, Operation>>;
};
const resolve = (ref: string): Schema => {
  const name = ref.replace("#/components/schemas/", "");
  const result = document.components.schemas[name];
  if (!result) throw new Error(`Unsupported schema reference: ${ref}`);
  return result;
};
const schema = (name: string) => resolve(`#/components/schemas/${name}`);
function operation(id: string): Operation {
  const result = Object.values(document.paths)
    .flatMap((path) => Object.values(path))
    .find((value) => value.operationId === id);
  if (!result) throw new Error(`Missing operation ${id}`);
  return result;
}
function request(id: string): Schema {
  const result = operation(id).requestBody?.content["application/json"].schema;
  if (!result) throw new Error(`Missing request schema ${id}`);
  return typeof result.$ref === "string" ? resolve(result.$ref) : result;
}
function equal(runtime: unknown, documented: Schema) {
  expect(structuralSchema(runtime as Schema, resolve)).toEqual(
    structuralSchema(documented, resolve),
  );
}
function compose(
  envelope: unknown,
  properties: Record<string, unknown>,
  required?: string[],
): Schema {
  const base = envelope as Schema;
  return {
    ...base,
    properties: { ...base.properties, ...properties } as Record<string, Schema>,
    ...(required ? { required } : {}),
  };
}

it("compares dialects without dropping tuple constraints, unknown keywords, or drift", () => {
  const draft7 = {
    type: "array",
    items: [{ type: "string" }, { type: "integer" }],
    additionalItems: false,
  } as Schema;
  equal(draft7, {
    type: "array",
    prefixItems: [{ type: "string" }, { type: "integer" }],
    items: false,
  });
  expect(() => structuralSchema({ contains: { type: "integer" } }, resolve)).toThrow("Unsupported");
  const changed = structuredClone(schema("NpcWrite"));
  changed.properties!.name!.maxLength = 99;
  expect(() => equal(npc.npcWriteSchema, changed)).toThrow();
  expect(() =>
    equal(
      { ...character.characterActiveSchema, additionalProperties: false },
      request("setGmCharacterActive"),
    ),
  ).toThrow();
});

describe("normalized request structural parity", () => {
  it("covers Agent turns", () => equal(agentTurnInputSchema, request("sendGameAgentTurn")));
  it("covers class template, copy, and save request contracts", () => {
    equal(catalog.createTemplateSchema, request("createClassTemplate"));
    equal(catalog.updateTemplateSchema, request("updateClassTemplate"));
    equal(catalog.updateGameClassSchema, request("updateGameClass"));
    equal(catalog.deleteGameClassSchema, request("deleteGameClass"));
    equal(catalog.copyClassSchema, request("copyClassToGame"));
    equal(catalog.saveClassToLibrarySchema, request("saveGameClassToLibrary"));
  });
  it("covers registration and game creation with explicit catalog semantics", () => {
    equal(credentialsSchema, schema("Registration"));
    const game = request("createGame");
    expect(game.properties!.systemId).toEqual({ type: "string", const: systems[0]!.id });
    expect(systems).toHaveLength(1);
    equal(gameSchema, compose(game, { systemId: { type: "string" } }));
    // Login clamps the username and maps malformed credentials to authentication failure.
    equal(credentialTextSchema, { type: "string" });
    expect(schema("Login").properties!.username).toMatchObject({ type: "string", maxLength: 128 });
    equal(credentialTextSchema, schema("Login").properties!.password!);
  });
  it("covers character envelopes while merged-sheet semantics remain transactional", () => {
    equal(
      compose(character.createCharacterEnvelopeSchema, { name: character.characterNameSchema }, [
        "id",
        "name",
      ]),
      request("createCharacter"),
    );
    const update = request("updateCharacter");
    expect(update.properties!.changes).toEqual({ $ref: "#/components/schemas/CharacterChanges" });
    equal(
      character.updateCharacterEnvelopeSchema,
      compose(update, { changes: { type: "object", additionalProperties: true } }),
    );
    equal(character.progressionChangesSchema, schema("CharacterChanges").properties!.progression!);
    equal(character.characterActiveSchema, request("setGmCharacterActive"));
    equal(character.characterControllerSchema, request("assignCharacter"));
  });
  it("covers both membership endpoints and invitation normalization", () => {
    equal(activeCharacterSchema, request("setMemberActiveCharacter"));
    equal(activeCharacterSchema, request("setOwnActiveCharacter"));
    equal(invitation.createInvitationSchema, request("createInvitation"));
    equal(invitation.updateInvitationSchema, request("setInvitationEnabled"));
    const accept = request("acceptInvitation");
    expect(accept.properties!.makeActive!.default).toBe(true);
    expect(operation("acceptInvitation").requestBody!.required).toBe(false);
    expect(operation("createInvitation").requestBody!.required).toBe(false);
    equal({ ...invitation.acceptInvitationSchema, required: [] }, accept);
  });
  it("covers NPC profiles and all staged envelopes", () => {
    equal(npc.npcWriteSchema, schema("NpcWrite"));
    equal(
      compose(npc.createNpcEnvelopeSchema, { id: uuidSchema, npc: npc.npcWriteSchema }),
      request("createNpc"),
    );
    equal(
      compose(npc.updateNpcEnvelopeSchema, {
        expectedRevision: npc.npcRevisionSchema,
        npc: npc.npcWriteSchema,
      }),
      request("replaceNpc"),
    );
    equal(
      compose(npc.removeNpcEnvelopeSchema, { expectedRevision: npc.npcRevisionSchema }),
      request("deleteNpc"),
    );
  });
  const shared = { modifier: roll.int32Schema, note: roll.noteSchema };
  const attribute = {
    expectedRevision: roll.revisionSchema,
    attributes: roll.attributesSchema,
    dice: roll.attributeDiceSchema,
    redDice: roll.diceSchemas.standardOptional,
    redModifier: roll.int32Schema,
  };
  const weapon = { expectedRevision: roll.revisionSchema, dice: roll.diceSchemas.standardPair };
  const setups = [
    [
      "AttributeThrowSetup",
      "attribute",
      roll.setupKeys.attribute,
      { ...attribute, characterId: uuidSchema },
    ],
    [
      "WeaponThrowSetup",
      "weapon",
      roll.setupKeys.weapon,
      { ...weapon, characterId: uuidSchema, equipmentId: uuidSchema },
    ],
    [
      "FreeThrowSetup",
      "free",
      roll.setupKeys.free,
      {
        characterId: { oneOf: [uuidSchema, { type: "string", const: "gm" }] },
        dice: roll.diceSchemas.freeRequired,
        redDice: roll.diceSchemas.freeOptional,
        redModifier: roll.int32Schema,
      },
    ],
    [
      "NpcAttributeThrowSetup",
      "npc-attribute",
      roll.setupKeys.npcAttribute,
      { ...attribute, npcId: uuidSchema },
    ],
    [
      "NpcAttackThrowSetup",
      "npc-attack",
      roll.setupKeys.npcAttack,
      { ...weapon, npcId: uuidSchema, attackId: uuidSchema },
    ],
  ] as const;
  it.each(setups)("covers strict %s setup components", (name, type, keys, properties) => {
    equal(
      compose(
        roll.keysSchema(keys),
        { ...shared, ...properties, type: { type: "string", const: type } },
        [...keys],
      ),
      schema(name),
    );
  });
  it("covers throw request keys, optional values, and cursor/query constraints", () => {
    equal(
      compose(
        roll.keysSchema(roll.setupKeys.request),
        {
          agentTurnId: uuidSchema,
          private: roll.booleanSchema,
          sourceThrowId: { anyOf: [uuidSchema, { type: "null" }] },
          setup: { oneOf: setups.map(([name]) => ({ $ref: `#/components/schemas/${name}` })) },
        },
        ["setup"],
      ),
      request("createThrow"),
    );
    expect(schema("CreateThrow").properties!.private!.default).toBe(false);
    const parameters = operation("listThrows").parameters!;
    equal(uuidSchema, parameters.find((parameter) => parameter.name === "before")!.schema);
    expect(parameters.find((parameter) => parameter.name === "limit")!.schema).toEqual({
      type: "integer",
      minimum: 1,
      maximum: 100,
      default: 20,
    });
  });
  it("covers shared route identifiers", () => {
    for (const name of [
      "gameId",
      "characterId",
      "npcId",
      "throwId",
      "membershipId",
      "invitationId",
    ])
      equal(uuidSchema, document.components.parameters[name]!.schema);
  });
});
