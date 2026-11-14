import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const root = dirname(fileURLToPath(import.meta.url));

for (const layer of ["base", "domain"]) {
  test(`${layer} design-system components respect their dependency boundary`, () => {
    const directory = resolve(root, layer);
    const allowed = layer === "base" ? directory : root;
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".vue"))) {
      const source = readFileSync(resolve(directory, file), "utf8");
      const imports = source.matchAll(/(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g);
      for (const [, target] of imports) {
        expect(
          resolve(directory, target).startsWith(`${allowed}/`),
          `${layer}/${file}: ${target}`,
        ).toBe(true);
      }
    }
  });
}
