import pg from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { applyMigrations } from "../../migrations.ts";
import { databaseFromPool } from "../../database/client.ts";
import { createSession } from "../../modules/auth/sessions.ts";
import { createApplication } from "../../app.ts";
import type { AgentProvider } from "../../modules/agent/types.ts";
import type { NoteEmbeddings } from "../../modules/game-notes/types.ts";

const url = process.env.TEST_DATABASE_URL;
const schema = `smoke_${randomUUID().replaceAll("-", "")}`;
const admin = url ? new pg.Pool({ connectionString: url }) : null;
const pool = url
  ? new pg.Pool({ connectionString: url, options: `-c search_path=${schema},public` })
  : null;
const gameId = randomUUID();
const gmAccount = randomUUID();

/** Calls search_notes, then get_notes with the found IDs, then replies. */
const provider: AgentProvider = {
  async complete({ messages, tools }) {
    const latest = messages.at(-1)!;
    const names = tools.map((tool) => tool.name);
    const reply = (text: string) => ({ text, calls: [], inputTokens: 10, outputTokens: 9 });
    if (latest.role === "user") {
      if (!names.includes("search_notes")) throw new Error("search_notes not registered");
      if (!names.includes("get_notes")) throw new Error("get_notes not registered");
      return {
        text: "",
        calls: [
          { id: "call1", name: "search_notes", arguments: JSON.stringify({ query: "compass" }) },
        ],
        inputTokens: 10,
        outputTokens: 5,
      };
    }
    if (latest.role === "tool" && latest.name === "search_notes") {
      const outcome = JSON.parse(latest.content);
      if (outcome.semanticStatus === "unavailable") throw new Error("semantic should run here");
      if (!outcome.matches.length) throw new Error("expected the compass match");
      if (outcome.matches[0].source !== "literal") throw new Error("literal wins with dedupe");
      return {
        text: "",
        calls: [
          {
            id: "call2",
            name: "get_notes",
            arguments: JSON.stringify({
              entryIds: outcome.matches.map((match: { entryId: string }) => match.entryId),
            }),
          },
        ],
        inputTokens: 10,
        outputTokens: 5,
      };
    }
    const outcome = JSON.parse(latest.content);
    return reply(`Found note: ${outcome.entries[0]?.title} — ${outcome.entries[0]?.text}`);
  },
};
const noteEmbeddings: NoteEmbeddings = {
  async embed(inputs) {
    return inputs.map(() => Array.from({ length: 1024 }, () => 0.5));
  },
};

describe.skipIf(!url)("agent turn through the note tools", () => {
  let runtime: ReturnType<typeof createApplication>;

  beforeAll(async () => {
    await admin!.query(`CREATE SCHEMA "${schema}"`);
    await admin!.query("CREATE EXTENSION IF NOT EXISTS vector");
    await applyMigrations(pool!);
    await pool!.query("INSERT INTO accounts(id,username,password_hash) VALUES($1,'gm','h')", [
      gmAccount,
    ]);
    await pool!.query(
      "INSERT INTO games(id,name,system_id,gm_account_id) VALUES($1,'G','fabula-ultima',$2)",
      [gameId, gmAccount],
    );
    await pool!.query(
      "INSERT INTO game_note_entries(game_id,id,title,content,text_fingerprint) VALUES($1,$2,'Compass cache','{\"ops\":[{\"insert\":\"The ferryman keeps a silver compass.\\n\"}]}'::jsonb,'fp')",
      [gameId, randomUUID()],
    );
    runtime = createApplication(databaseFromPool(pool!), undefined, {
      agentProvider: provider,
      noteEmbeddings,
    });
  });
  afterAll(async () => {
    runtime?.dispose();
    await pool?.end();
    await admin?.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin?.end();
  });

  it("serves a turn through search_notes and get_notes", async () => {
    const server = runtime.app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No server address");
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      const session = await createSession(
        databaseFromPool(pool!),
        gmAccount,
        new Date(Date.now() + 60_000),
      );
      const browserCookie = `rpg_session=${session.token}`;
      const csrf = await fetch(`${origin}/api/auth/csrf`, { headers: { cookie: browserCookie } });
      const { csrfToken } = (await csrf.json()) as { csrfToken: string };
      const cookie = `${browserCookie}; ${csrf.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ")}`;
      const response = await fetch(`${origin}/api/games/${gameId}/agent/turns`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          cookie,
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ message: "where is the compass" }),
      });
      if (response.status !== 200) console.info(await response.text());
      expect(response.status).toBe(200);
      const turn = (await response.json()) as { reply: string; tools: { label: string }[] };
      expect(turn.reply).toContain("Compass cache");
      expect(turn.reply).toContain("The ferryman keeps a silver compass.");
      expect(turn.tools.map((tool) => tool.label)).toContain("Searched the GM’s notes");
      expect(turn.tools.map((tool) => tool.label)).toContain("Read saved note entries");
    } finally {
      server.close();
      server.closeAllConnections();
    }
  });
});
