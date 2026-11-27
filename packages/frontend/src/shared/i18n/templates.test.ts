import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "@vue/compiler-sfc";
import { expect, it } from "vite-plus/test";

/** Guard the production surfaces that can be audited without guessing whether a JS string is data. */
it("uses translations for static template copy and accessible labels", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const violations: string[] = [];
  for (const file of globSync("**/*.vue", { cwd: root })) {
    const template = parse(readFileSync(`${root}/${file}`, "utf8")).descriptor.template?.ast;
    if (!template) continue;
    const visit = (node: (typeof template.children)[number]) => {
      if (node.type === 2 && /[A-Za-z]/.test(node.content))
        violations.push(`${file}:${node.loc.start.line}: ${node.content.trim()}`);
      if (node.type !== 1) return;
      for (const prop of node.props) {
        if (
          prop.type !== 6 ||
          !/^(?:.*-label|label|alt|title|description|placeholder|text)$/.test(prop.name)
        )
          continue;
        if (prop.value && /[A-Za-z]/.test(prop.value.content))
          violations.push(`${file}:${prop.loc.start.line}: ${prop.name}="${prop.value.content}"`);
      }
      node.children.forEach(visit);
    };
    template.children.forEach(visit);
  }
  expect(violations).toEqual([]);
});
