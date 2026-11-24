import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { expect, it } from "vite-plus/test";

it("enforces import boundaries on resolved TypeScript and Vue dependencies", () => {
  const root = mkdtempSync(join(tmpdir(), "rpg-boundaries-"));
  const backend = "packages/backend/src/";
  const modules = backend + "modules/";
  const frontend = "packages/frontend/src/";
  const expected = [];

  function fixture(path, code, rule, target) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, code);
    if (rule) expected.push([path, target, rule]);
  }

  try {
    const types = modules + "characters/types.ts";
    const service = modules + "characters/service.ts";
    fixture(types, "export interface Character {}");
    fixture(service, "export const service = 1");
    fixture(modules + "fabula/rolls.ts", "export const roll = 1");
    fixture(modules + "rpg-systems/catalog.ts", "export const catalog = 1");
    fixture(
      backend + "application/ownership.ts",
      'export * from "../modules/characters/service.ts"',
    );
    fixture(backend + "app.ts", 'export * from "./modules/characters/service.ts"');
    fixture(
      modules + "throws/valid.ts",
      [
        'import type { Character } from "../characters/types.ts"',
        'export { type Character as C } from "../characters/types.ts"',
        'type Alias = import("../characters/types.ts").Character',
        'export * from "../fabula/rolls.ts"',
        'export * from "../rpg-systems/catalog.ts"',
      ].join("\n"),
    );
    fixture(modules + "throws/service.test.ts", 'export * from "../characters/service.ts"');
    const forbiddenImports = [
      'import { service } from "../characters/service.ts"',
      'import type { service } from "../characters/service.ts"',
      'export * from "../characters/service.ts"',
      'import("../characters/service.ts")',
      'require("../characters/service.ts")',
      "import(`../characters/service.ts`)",
    ];
    for (const [index, code] of forbiddenImports.entries()) {
      fixture(modules + `throws/case-${index}.ts`, code, "no-sibling-implementation", service);
    }
    fixture(
      modules + "throws/value.ts",
      'import { Character } from "../characters/types.ts"',
      "sibling-types-are-type-only",
      types,
    );
    fixture(
      modules + "throws/types.ts",
      'type S = typeof import("./value.ts")',
      "no-public-types-to-implementation",
      modules + "throws/value.ts",
    );
    fixture(
      modules + "throws/workflow.ts",
      'export * from "../../application/ownership.ts"',
      "no-module-to-application",
      backend + "application/ownership.ts",
    );
    fixture(modules + "throws/party-controller.ts", "export const party = 1");
    fixture(
      modules + "throws/controller.ts",
      'export * from "./party-controller.ts"',
      "no-controller-to-controller",
      modules + "throws/party-controller.ts",
    );
    const prototype = "packages/frontend/prototypes/mock.ts";
    fixture(prototype, "export const mock = 1");
    fixture(
      frontend + "Example.vue",
      '<script setup lang="ts">import { mock } from "../prototypes/mock.ts"</script>',
      "no-prototype-imports",
      prototype,
    );
    fixture(frontend + "bare.ts", 'import "prototypes"', "no-prototype-imports", "prototypes");

    const output = execFileSync(
      resolve("node_modules/.bin/depcruise"),
      [
        "--config",
        resolve(".dependency-cruiser.mjs"),
        "--output-type",
        "json",
        "packages/backend/src",
        "packages/frontend/src",
      ],
      { cwd: root, encoding: "utf8" },
    );
    const { summary } = JSON.parse(output);
    const violations = summary.violations.map(({ from, to, rule }) => [from, to, rule.name]);
    expect(violations).toHaveLength(expected.length);
    expect(violations).toEqual(expect.arrayContaining(expected));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
