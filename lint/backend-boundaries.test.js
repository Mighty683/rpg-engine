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
