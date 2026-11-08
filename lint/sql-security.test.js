import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "./sql-security.js";

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester();
const error = { messageId: "dynamic" };

tester.run("static-query", plugin.rules["static-query"], {
  valid: [
    'client.query("SELECT * FROM accounts WHERE id = $1", [id])',
    "client.query(`SELECT 1`)",
    'const sql = "SELECT 1"; function run(client) { client.query(sql); }',
    'const sql = "SELECT 1"; function other(sql) {} client.query(sql)',
    "client.queryOther(input)",
  ],
  invalid: [
    { code: "client.query(`SELECT ${input}`)", errors: [error] },
    { code: 'client.query("SELECT " + input)', errors: [error] },
    { code: "client.query(input)", errors: [error] },
    { code: 'client["query"](input)', errors: [error] },
    {
      code: 'const sql = "SELECT 1"; function run(client, sql) { client.query(sql) }',
      errors: [error],
    },
    { code: 'let sql = "SELECT 1"; client.query(sql)', errors: [error] },
    { code: 'function run(client) { const sql = "SELECT 1"; client.query(sql) }', errors: [error] },
    { code: "client.query()", errors: [error] },
  ],
});

tester.run("no-drizzle-raw", plugin.rules["no-drizzle-raw"], {
  valid: ["import { sql } from 'drizzle-orm'; sql`select ${value}`", "other.raw(value)"],
  invalid: [
    { code: "import { sql } from 'drizzle-orm'; sql.raw(value)", errors: [{ messageId: "raw" }] },
    {
      code: "import { sql as query } from 'drizzle-orm'; query['raw']('select 1')",
      errors: [{ messageId: "raw" }],
    },
  ],
});
