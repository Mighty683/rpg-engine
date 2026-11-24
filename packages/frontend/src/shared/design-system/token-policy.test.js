import { expect, test } from "vite-plus/test";
import { ESLint } from "eslint";
import stylelint from "stylelint";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../../..", import.meta.url));
const templates = new ESLint({ cwd });
const styles = new ESLint({ cwd, overrideConfigFile: join(cwd, "eslint.styles.config.mjs") });
async function diagnostics(file, source) {
  const filePath = join(cwd, "src", file);
  const messages = (await templates.lintText(source, { filePath }))[0].messages;
  if (file.endsWith(".vue")) {
    messages.push(...(await styles.lintText(source, { filePath }))[0].messages);
    const result = await stylelint.lint({ cwd, codeFilename: filePath, code: source });
    messages.push(...result.results[0].warnings.map((w) => ({ line: w.line, message: w.text })));
  }
  return messages.map((m) => m.line + ": " + m.message);
}

const feature = "modules/game-table/Table.vue";
test("flags source locations in templates, slot overrides and scoped CSS", async () => {
  const source = `<template>
    <UCard class="sm:hover:!p-2" :class="{ 'gap-[3px]': expanded }"
      :ui="{ body: 'mb-4' }" style="margin: 2px"/>
  </template>
  <style scoped>
  a { padding: 1rem; color: var(--value-white); --spacing-small: 3rem; }
  a:hover { @apply sm:p-4; }
  </style>`;
  const errors = await diagnostics(feature, source);
  for (const [line, value] of [
    [2, "sm:hover:!p-2"],
    [2, "gap-[3px]"],
    [3, "mb-4"],
    [3, "2px"],
    [6, "1rem"],
    [6, "--value-white"],
    [6, "--spacing-small"],
    [7, "sm:p-4"],
  ])
    expect(
      errors.some((message) => message.startsWith(line + ": ") && message.includes(value)),
    ).toBe(true);
});

test("sheets extend the public tokens without exposing their own tokens to other features", async () => {
  const source = `<template><div class="sm:px-medium h-[37px] mx-auto p-0"/></template>
  <style>.field { padding: var(--sheet-field-padding); gap: var(--spacing-tight); }</style>`;
  for (const file of ["modules/characters/sheet/Field.vue", "modules/npcs/NpcSheet.vue"])
    expect(await diagnostics(file, source)).toEqual([]);
  expect(await diagnostics(feature, source)).not.toEqual([]);
  expect(
    await diagnostics(
      "modules/npcs/NpcSheet.vue",
      source.replace("--sheet-field-padding", "--sheet-invented"),
    ),
  ).not.toEqual([]);
});

test("helper returns use the same spacing policy as templates", async () => {
  const file = "modules/game-table/row.ts";
  expect(
    await diagnostics(file, 'export function classes() { return "flex sm:p-4"; }'),
  ).not.toEqual([]);
  expect(
    await diagnostics(file, 'export function classes() { return "flex sm:p-small"; }'),
  ).toEqual([]);
});
