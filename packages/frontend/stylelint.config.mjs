import { ignored, privateToken, sheets, spacingNames, tokens } from "./token-lint.config.mjs";

function rules(sheet) {
  const value = "(?:0|auto|var\\((?:" + spacingNames(sheet) + ")\\))";
  const position = "(?:" + value + "|\\d+(?:\\.\\d+)?%)";
  const list = (item) => "/^" + item + "(?:\\s+" + item + ")*$/";
  return {
    "property-disallowed-list": ["/^--(?:spacing|value|sheet)(?:-|$)/", ...tokens],
    "declaration-property-value-allowed-list": {
      "/^(?:(?:scroll-)?(?:margin|padding)(?:-[a-z-]+)?|(?:row-|column-)?gap)$/": [list(value)],
      "/^(?:inset(?:-[a-z-]+)?|left|right|top|bottom)$/": [list(position)],
    },
    "declaration-property-value-disallowed-list": { "/.+/": ["/" + privateToken(sheet) + "/"] },
  };
}
export default {
  ignoreFiles: ignored,
  rules: rules(false),
  overrides: [
    { files: ["**/*.vue"], customSyntax: "postcss-html" },
    { files: sheets, rules: rules(true) },
  ],
};
