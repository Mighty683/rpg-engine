import css from "@eslint/css";
import tailwind from "eslint-plugin-better-tailwindcss";
import vueBlocks from "eslint-processor-vue-blocks";
import { tailwind4 } from "tailwind-csstree";
import { ignored, restrictedClasses, sheets } from "./token-lint.config.mjs";

const rules = (sheet) => ({
  "tailwind/no-restricted-classes": ["error", { restrict: restrictedClasses(sheet) }],
});
export default [
  { ignores: ignored },
  { files: ["src/**/*.vue"], processor: vueBlocks({ blocks: { styles: true } }) },
  {
    files: ["src/**/*.css"],
    plugins: { css, tailwind },
    language: "css/css",
    languageOptions: { customSyntax: tailwind4, tolerant: true },
    rules: rules(false),
  },
  // The processor gives each embedded stylesheet a virtual path below its Vue filename.
  {
    files: sheets.map((glob) => (glob.endsWith(".vue") ? glob + "/**/*.css" : glob + "/*.css")),
    rules: rules(true),
  },
];
