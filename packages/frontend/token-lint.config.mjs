// Shared configuration data for ESLint and Stylelint, derived from the production token registry.
import { readFileSync } from "node:fs";
import postcss from "postcss";

export const ignored = [
  "src/shared/design-system/**",
  "src/tokens.css",
  "**/*.{test,browser,d}.ts",
];
export const sheets = [
  "src/modules/characters/sheet/**",
  "src/modules/npcs/{NpcSheet,NpcAttacksEditor}.vue",
];
export const tokens = new Set();
for (const file of [
  "tokens.css",
  "shared/design-system/domain/tokens.css",
  "shared/design-system/domain/sheet-tokens.css",
]) {
  const css = readFileSync(new URL("./src/" + file, import.meta.url), "utf8");
  postcss.parse(css).walkDecls(/^--/, ({ prop }) => tokens.add(prop));
}
const sheetNames = [...tokens].filter((name) => name.startsWith("--sheet-")).join("|");
export const privateToken = (sheet) =>
  sheet ? "--value-|(?!(?:" + sheetNames + ")(?![\\w-]))--sheet-" : "--(?:value|sheet)-";

export const spacingNames = (sheet) =>
  [...tokens]
    .filter(
      (name) =>
        (sheet || !name.startsWith("--sheet-")) &&
        /^(?:--spacing-|--sheet-spacing-|--sheet-tight$)|-(?:padding|gap|indent)$/.test(name),
    )
    .join("|");

const utilities =
  "(?:(?:scroll-)?[pm](?:[xystrlbe]|[ib][se])?|gap(?:-[xy])?|space-[xy]|inset(?:-[xyse]|-b[se]?)?|left|right|top|bottom|start|end)";
const scale = [...tokens]
  .filter((name) => name.startsWith("--spacing-"))
  .map((name) => name.slice(10))
  .join("|");
export function restrictedClasses(sheet) {
  const token = "(?:" + spacingNames(sheet) + ")";
  const allowed = "(?:0|auto|" + scale + "|\\(" + token + "\\)|\\[var\\(" + token + "\\)\\])";
  // Match the complete utility before checking its suffix, including multi-part prefixes such as gap-x.
  const valid = "(?:" + utilities + "-" + allowed + "|space-[xy]-reverse)!?(?=$|\\s)";
  return [
    "(?:^|:)!?-?(?!" + valid + ")" + utilities + "-[^\\s]+",
    privateToken(sheet),
    "\\[--(?:spacing(?:-|:)|(?:" + [...tokens].map((s) => s.slice(2)).join("|") + "):)",
    "\\[(?:padding|margin|gap|inset|top|left|right|bottom)(?:-[\\w-]+)?:(?!(?:0|auto|var\\(" +
      token +
      "\\))\\])",
  ];
}
