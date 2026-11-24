import ts from "@typescript-eslint/parser";
import tailwind from "eslint-plugin-better-tailwindcss";
import vue from "vue-eslint-parser";
import { ignored, privateToken, restrictedClasses, sheets } from "./token-lint.config.mjs";

function rules(sheet) {
  const restrict = restrictedClasses(sheet);
  // The Tailwind plugin handles template classes. Core selectors also cover JS/TS helper returns.
  const spacing = restrict[0].replace("(?:^|:)", "(?:^|\\s|:)");
  return {
    "tailwind/no-restricted-classes": ["error", { restrict }],
    "no-restricted-syntax": [
      "error",
      ...[privateToken(sheet), spacing].flatMap((pattern) =>
        ["Literal[value", "TemplateElement[value.raw"].map((field) => ({
          selector: field + "=/" + pattern + "/]",
          message: "Use registered semantic tokens for this feature.",
        })),
      ),
    ],
  };
}
export default [
  { ignores: ignored },
  {
    files: ["src/**/*.{vue,ts,tsx,js,jsx}"],
    plugins: { tailwind },
    languageOptions: { parser: ts },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/style.css",
        selectors: {
          extends: [{ kind: "attribute", name: ":ui", match: [{ type: "objectValues" }] }],
        },
      },
    },
    rules: rules(false),
  },
  { files: ["src/**/*.vue"], languageOptions: { parser: vue, parserOptions: { parser: ts } } },
  { files: sheets, rules: rules(true) },
];
