import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "./backend-boundaries.js";
RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester();
const file = (name) => `/repo/packages/backend/src/${name}`;
const moduleFile = file("modules/throws/service.ts");
const valid = (code, filename = moduleFile) => ({ code, filename });
const invalid = (code, messageId, filename = moduleFile) => ({
  code,
  filename,
  errors: [{ messageId }],
});
tester.run("imports", plugin.rules.imports, {
  valid: [
    valid('import type { CharactersService } from "../characters/types.ts"'),
    valid('import { type CharactersService } from "../characters/types.ts"'),
    valid('import { resolveThrow } from "./resolve.ts"'),
    valid('import { rollDie } from "../fabula/rolls.ts"'),
    valid('import { findSystem } from "../rpg-systems/catalog.ts"'),
    valid(
      'import { createCharactersService } from "./modules/characters/factory.ts"',
      file("app.ts"),
    ),
    valid(
      'import { createCharacterOwnership } from "../modules/characters/ownership.ts"',
      file("application/ownership.ts"),
    ),
  ],
  invalid: [
    invalid(
      'type Service = ReturnType<typeof import("./factory.ts").createThrowsService>',
      "implementationType",
      file("modules/throws/types.ts"),
    ),
    invalid('import { sheetSequential } from "../characters/service.ts"', "dependency"),
    invalid(
      'import type { createCharactersService } from "../characters/factory.ts"',
      "dependency",
    ),
    invalid('export * from "../characters/service.ts"', "dependency"),
    invalid('import("../characters/service.ts")', "dependency"),
    invalid('require("../characters/service.ts")', "dependency"),
    invalid("import(`../characters/service.ts`)", "dependency"),
    invalid('import { CharactersService } from "../characters/types.ts"', "dependency"),
    invalid('import { runWorkflow } from "../../application/ownership.ts"', "layering"),
    invalid(
      'import type { createThrowsService } from "./factory.ts"; type Service = ReturnType<typeof createThrowsService>',
      "implementationType",
      file("modules/throws/types.ts"),
    ),
    invalid(
      'import { routeId } from "../games/controller.ts"',
      "controller",
      file("modules/throws/controller.ts"),
    ),
    invalid(
      'import { controller } from "./party-controller.ts"',
      "controller",
      file("modules/characters/controller.ts"),
    ),
  ],
});
tester.run("owner-writes", plugin.rules["owner-writes"], {
  valid: [
    valid('import { throws } from "../../database/schema.ts"; tx.insert(throws)'),
    valid('import { characters } from "../../database/schema.ts"; tx.select().from(characters)'),
    valid('const entries = new Map(); entries.delete("key")'),
    valid(
      'import { characters } from "../../database/schema.ts"; tx.update(characters)',
      file("modules/characters/ownership.ts"),
    ),
  ],
  invalid: [
    invalid(
      'import { characters } from "../../database/schema.ts"; tx.update(characters)',
      "ownership",
    ),
    invalid(
      'import { players as members } from "../../database/schema.ts"; tx.insert(members)',
      "ownership",
    ),
    invalid(
      'import * as tables from "../../database/schema.ts"; tx.delete(tables.invitations)',
      "ownership",
    ),
    invalid(
      'import * as tables from "../../database/schema.ts"; tx["update"](tables["npcs"])',
      "ownership",
    ),
    invalid(
      'import { players } from "../database/schema.ts"; tx.update(players)',
      "ownership",
      file("application/ownership.ts"),
    ),
  ],
});
