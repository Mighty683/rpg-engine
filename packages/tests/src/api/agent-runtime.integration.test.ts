import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { createApiFixture, csrfHeaders, type ApiFixture } from "./fixtures.ts";
import { createApplication } from "../../../backend/src/app.ts";
import { databaseFromPool } from "../../../backend/src/database/client.ts";
import { createSession } from "../../../backend/src/modules/auth/sessions.ts";
import type {
  AgentCompletion,
  AgentProvider,
  AgentToolName,
} from "../../../backend/src/modules/agent/types.ts";

let f: ApiFixture;
const finish = (text = "All done"): AgentCompletion => ({
  text,
  calls: [],
  inputTokens: 100,
  outputTokens: 10,
});
const tool = (name: AgentToolName, args: unknown): AgentCompletion => ({
  ...finish(""),
  calls: [{ id: "call00001", name, arguments: JSON.stringify(args) }],
});
const complete = vi.fn<AgentProvider["complete"]>();
const send = (message: string, game = f.ids.game, identity = "gm") =>
  f.request("/games/" + game + "/agent/turns", identity, "POST", { message });
const stored = async () =>
  Number((await f.pool.query("select count(*) from agent_turns")).rows[0].count);
const moveWindow = () =>
  f.pool.query("update sign_in_attempts set window_started_at=now()-interval '2 minutes'");
beforeEach(async () => {
  complete.mockReset().mockResolvedValue(finish());
  f = await createApiFixture("agent_runtime", {
    application: { agentProvider: { complete }, errorLogger: () => {} },
  });
  await f.pool.query("update characters set gm_active=true where id=$1", [f.ids.gmCharacter]);
});
afterEach(async () => {
  await f?.cleanup();
});

it("GM-API-02 sends only authorized game facts, and fetches sensitive fields on demand", async () => {
  const npc = randomUUID();
  await f.pool.query(
    "insert into npcs(id,game_id,name,relationship,level,visibility,dex_die,ins_die,mig_die,wlp_die,current_hp,max_hp,current_mp,max_mp,defense,magic_defense,notes) values($1,$2,'Hidden Sentinel','neutral',5,'hidden',8,8,8,8,5,5,5,5,5,5,'gm-note-marker')",
    [npc, f.ids.game],
  );
  for (const [i, note] of [
    "public-marker",
    "own-private-marker",
    "foreign-private-marker",
  ].entries()) {
    await f.pool.query(
      "insert into throws(id,game_id,seq,author_account_id,role,character_name,kind,setup,outcome,private) values($1,$2,$3,$4,'GM','GM','free',$5,'{}',$6)",
      [randomUUID(), f.ids.game, i + 1, i === 2 ? f.ids.player : f.ids.gm, { note }, i > 0],
    );
  }
  complete
    .mockResolvedValueOnce(tool("read_npc", { id: "Hidden Sentinel", includeNotes: true }))
    .mockResolvedValueOnce(tool("read_throws", {}));
  const res = await send("What are the hidden NPC notes and recent throws?");
  expect(res.status).toBe(200);
  const turn = await res.json();
  expect(turn.tools.map((v: { tool: string }) => v.tool)).toEqual(["read_npc", "read_throws"]);
  const messages = complete.mock.calls[2]![0].messages;
  expect(messages[1]!.content).toContain("Hidden Sentinel");
  expect(messages[1]!.content).not.toContain("gm-note-marker");
  expect(JSON.stringify(complete.mock.calls[0]![0].messages)).not.toContain("gm-note-marker");
  const outbound = JSON.stringify(messages);
  for (const marker of ["gm-note-marker", "public-marker", "own-private-marker"])
    expect(outbound).toContain(marker);
  expect(outbound).not.toContain("foreign-private-marker");
  expect(JSON.stringify((await f.pool.query("select * from agent_turns")).rows)).not.toContain(
    "foreign-private-marker",
  );
});

it("GM-API-03 narrows skill advice to learned facts and rejects invalid tools and cross-game targets", async () => {
  const classId = randomUUID(),
    learned = randomUUID(),
    other = randomUUID();
  await f.pool.query(
    "insert into game_classes (id,game_id,system_id,name,description,free_benefits) values($1,$2,'fabula-ultima','Class','', '[]')",
    [classId, f.ids.game],
  );
  await f.pool.query(
    "insert into game_class_skills (id,game_class_id,game_id,position,name,description,max_rank,benefits) values ($1,$3,$4,1,'Applied Die','Passive accuracy die',1,$5),($2,$3,$4,2,'Unlearned Marker','',1,'[]')",
    [
      learned,
      other,
      classId,
      f.ids.game,
      JSON.stringify([
        { kind: "modifier", name: "Passive", stat: "dieDex", amount: 1, id: randomUUID() },
      ]),
    ],
  );
  await f.pool.query(
    "insert into character_class_levels (character_id,game_id,game_class_id,level) values($1,$2,$3,1)",
    [f.ids.gmCharacter, f.ids.game, classId],
  );
  await f.pool.query(
    "insert into character_skill_ranks(character_id,game_id,game_class_id,skill_id,rank) values($1,$2,$3,$4,1)",
    [f.ids.gmCharacter, f.ids.game, classId, learned],
  );
  await f.pool.query(
    "insert into character_skills (id,character_id,name,notes,position) values($1,$2,'Damage','Extra damage after a hit',1)",
    [randomUUID(), f.ids.gmCharacter],
  );
  complete.mockResolvedValueOnce(
    tool("read_character", { id: "GM sheet", sections: ["skills", "stats"] }),
  );
  expect((await send("Which skill helps my shot?")).status).toBe(200);
  const tools = JSON.stringify(complete.mock.calls[1]![0].messages.at(-1));
  expect(tools).toContain("Extra damage after a hit");
  expect(tools).toContain("Applied Die");
  expect(tools).not.toContain("Unlearned Marker");
  complete.mockResolvedValueOnce(
    tool("read_character", { id: f.ids.foreignCharacter, sections: ["skills"] }),
  );
  expect((await send("Read this character")).status).toBe(200);
  expect(complete.mock.calls[3]![0].messages.at(-1)?.content).toBe('{"found":false}');
  for (const invalid of [
    tool("read_character", { id: f.ids.gmCharacter, sections: ["skills"], sql: "x" }),
    { ...finish(), calls: [{ name: "class_library", id: "fake", arguments: "{}" }] },
  ]) {
    complete.mockResolvedValueOnce(invalid);
    expect((await send("Read invalid tool")).status).toBe(502);
  }
  expect(await stored()).toBe(2);
  expect((await f.pool.query("select count(*) from throws")).rows[0].count).toBe("0");
});

it("GM-API-06 reauthorizes before subsequent calls and publication after roster changes and logout", async () => {
  complete.mockImplementationOnce(async () => {
    await f.pool.query("update characters set gm_active=false where id=$1", [f.ids.gmCharacter]);
    return tool("read_character", { id: f.ids.gmCharacter, sections: ["stats"] });
  });
  const narrowed = await send("Describe the party");
  expect(narrowed.status).toBe(409);
  expect((await narrowed.json()).error.code).toBe("ERR03");
  complete.mockImplementationOnce(async () => {
    await f.pool.query("delete from sessions where account_id=$1", [f.ids.gm]);
    return finish();
  });
  expect((await send("Hello")).status).toBe(401);
  expect(complete).toHaveBeenCalledTimes(2);
  expect(await stored()).toBe(0);
  const session = await createSession(
    databaseFromPool(f.pool),
    f.ids.gm,
    new Date(Date.now() + 60_000),
  );
  expect((await send("Hello again", f.ids.game, session.token)).status).toBe(200);
});

it("GM-API-07 reserves one slot per game and ten per process across accounts", async () => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  complete.mockImplementation(async () => {
    await held;
    return finish();
  });
  const first = send("Held");
  await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
  const anotherSession = await createSession(
    databaseFromPool(f.pool),
    f.ids.gm,
    new Date(Date.now() + 60_000),
  );
  expect((await send("Racing", f.ids.game, anotherSession.token)).status).toBe(409);
  const running = [first];
  try {
    for (let i = 0; i < 10; i++) {
      const gm = randomUUID(),
        game = randomUUID();
      await f.pool.query("insert into accounts(id,username,password_hash) values($1,$2,'hash')", [
        gm,
        gm,
      ]);
      await f.pool.query(
        "insert into games(id,name,system_id,gm_account_id) values($1,'Extra','fabula-ultima',$2)",
        [game, gm],
      );
      const session = await createSession(
        databaseFromPool(f.pool),
        gm,
        new Date(Date.now() + 60_000),
      );
      const res = send("Held", game, session.token);
      if (i === 9) {
        const excess = await res;
        expect(excess.status).toBe(429);
        expect(excess.headers.get("retry-after")).toBeTruthy();
      } else {
        running.push(res);
        await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(i + 2));
      }
    }
  } finally {
    release();
  }
  expect((await Promise.all(running)).map((r) => r.status)).toEqual(Array(10).fill(200));
  expect(await stored()).toBe(10);
});

it("GM-API-08 shares the six-turn window across games and sessions", async () => {
  await f.pool.query("update games set gm_account_id=$1 where id=$2", [f.ids.gm, f.ids.otherGame]);
  const session = await createSession(
    databaseFromPool(f.pool),
    f.ids.gm,
    new Date(Date.now() + 60_000),
  );
  for (let i = 0; i < 6; i++)
    expect(
      (await send("hello", i % 2 ? f.ids.game : f.ids.otherGame, i % 2 ? "gm" : session.token))
        .status,
    ).toBe(200);
  const refused = await send("one too many");
  expect(refused.status).toBe(429);
  expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(await stored()).toBe(6);
  expect(complete).toHaveBeenCalledTimes(6);
  await moveWindow();
  expect((await send("new window")).status).toBe(200);
});

it("GM-API-09 bounds calls, tokens, deadline and provider failure and releases the game slot", async () => {
  complete.mockResolvedValue(tool("read_throws", {}));
  expect((await send("Keep reading")).status).toBe(502);
  expect(complete.mock.calls.length).toBe(11);
  complete.mockResolvedValueOnce({ ...tool("read_throws", {}), inputTokens: 19999 });
  expect((await send("Too much input")).status).toBe(502);
  complete.mockResolvedValueOnce({ ...tool("read_throws", {}), outputTokens: 2000 });
  expect((await send("Too much output")).status).toBe(502);
  complete.mockResolvedValueOnce(finish(""));
  expect((await send("Malformed reply")).status).toBe(502);
  complete.mockRejectedValueOnce(
    Object.assign(new Error("Unavailable"), { code: "agent_unavailable" }),
  );
  expect((await send("Provider down")).status).toBe(503);
  let late!: (result: AgentCompletion) => void;
  complete.mockImplementationOnce(
    () =>
      new Promise((r) => {
        late = r;
      }),
  );
  const timed = await send("Late reply");
  expect(timed.status).toBe(504);
  late(finish());
  expect(await stored()).toBe(0);
  await moveWindow();
  complete.mockResolvedValue(finish());
  expect((await send("Recover")).status).toBe(200);
}, 20_000);

it("GM-API-09 aborts a disconnected turn before a late completion is stored", async () => {
  let resolve!: (reply: AgentCompletion) => void;
  complete.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const headers = await csrfHeaders(f.origin, "rpg_session=" + f.tokens.gm);
  const signal = new AbortController();
  const res = fetch(f.origin + "/api/games/" + f.ids.game + "/agent/turns", {
    method: "POST",
    headers: { ...headers, origin: f.origin, "content-type": "application/json" },
    signal: signal.signal,
    body: JSON.stringify({ message: "Disconnect" }),
  });
  await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
  signal.abort();
  await expect(res).rejects.toThrow();
  await vi.waitFor(async () =>
    expect(
      (await (await f.request("/games/" + f.ids.game + "/agent/status", "gm")).json()).busy,
    ).toBe(false),
  );
  resolve(finish());
  expect(await stored()).toBe(0);
});

it("GM-API-11 recovers an already committed turn from a fresh application after losing its response", async () => {
  await send("Read the party"); // Client loses the response and reconnects without resending.
  const restarted = createApplication(databaseFromPool(f.pool), undefined, {
    agentProvider: { complete },
  });
  const server = restarted.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw Error("Expected listener");
    const res = await fetch(
      "http://127.0.0.1:" + address.port + "/api/games/" + f.ids.game + "/agent/status",
      { headers: { cookie: "rpg_session=" + f.tokens.gm } },
    );
    const page = await res.json();
    expect(page.turns).toHaveLength(1);
    expect(page.turns[0]).toEqual({
      id: expect.any(String),
      message: "Read the party",
      author: expect.any(String),
      tools: [],
      reply: "All done",
    });
    expect(complete).toHaveBeenCalledTimes(1);
  } finally {
    restarted.dispose();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
