import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "./prototype-boundary.js";

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester();
const error = { messageId: "prototype" };

tester.run("no-prototype-imports", plugin.rules["no-prototype-imports"], {
  valid: [
    'import "../components/example"',
    'import "../prototypes-helper/example"',
    'export * from "./module"',
    'import("./module")',
  ],
  invalid: [
    { code: 'import "../../prototypes/example"', errors: [error] },
    { code: 'export { value } from "../../prototypes/example"', errors: [error] },
    { code: 'export * from "../../prototypes/example"', errors: [error] },
    { code: 'import("../../prototypes/example")', errors: [error] },
    { code: 'require("../../prototypes/example")', errors: [error] },
    { code: "import(`../../prototypes/example`)", errors: [error] },
    { code: 'import "prototypes"', errors: [error] },
  ],
});
