import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { Database } from "../../database/client.ts";
import { Application, ExpressAdapter } from "arrow-express";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { type GameAccessRepository } from "../games/service.ts";
import { membershipsController } from "./membership-controller.ts";
import { createServices } from "../../services.ts";

const state = vi.hoisted(() => ({
  games: new Map<string, string>(),
  members: new Map<string, { id: string; accountId: string; gameId: string; removed: boolean }>(),
  sessions: new Map<string, string>(),
}));

vi.mock("../auth/sessions.ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("../auth/sessions.ts")>(),
  resolveSession: async (_pool: Database, token: string) => {
    const accountId = state.sessions.get(token);
    return accountId ? { accountId, sessionId: token } : null;
  },
}));

vi.mock("../games/service.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("../games/service.ts")>();
  return {
    ...original,
    gameAccess: async (
      _pool: Database,
      actor: { accountId: string; sessionId: string },
      gameId: string,
    ) => original.resolveGameAccess(repository, actor, gameId),
  };
});

vi.mock("./membership.ts", () => ({
  listMembers: async () => [...state.members.values()],
  setMemberRemoved: async (
    _pool: Database,
    _actor: unknown,
    gameId: string,
    memberId: string,
    removed: boolean,
  ) => {
    const member = state.members.get(memberId);
    if (!member || member.gameId !== gameId)
      throw Object.assign(new Error("not_found"), { code: "not_found" });
    member.removed = removed;
    return member;
  },
  selectPlayerCharacter: vi.fn(),
}));

const repository: GameAccessRepository = {
  async findGameAccess(gameId, accountId) {
    const gmAccountId = state.games.get(gameId);
    if (!gmAccountId) return null;
    const member = [...state.members.values()].find(
      (entry) => entry.gameId === gameId && entry.accountId === accountId && !entry.removed,
    );
    return { gmAccountId, membershipId: member?.id ?? null };
  },
};

let server: Server;
let origin: string;
const game = randomUUID();
const otherGame = randomUUID();
const member = randomUUID();
const otherMember = randomUUID();

async function request(path: string, token: string, method = "GET") {
  return fetch(`${origin}/api${path}`, {
    method,
    headers: { origin, cookie: `rpg_session=${token}` },
  });
}

describe("membership API permissions with in-memory access repository", () => {
  beforeAll(async () => {
    const app = express();
    ExpressAdapter(
      app,
      Application()
        .prefix("api")
        .registerControllers(membershipsController(createServices({} as Database))),
    ).configure(false);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No server address");
    origin = `http://127.0.0.1:${address.port}`;
  });
  beforeEach(() => {
    state.games.clear();
    state.members.clear();
    state.sessions.clear();
    state.games.set(game, "gm");
    state.games.set(otherGame, "outsider");
    state.members.set(member, { id: member, gameId: game, accountId: "player", removed: false });
    state.members.set(otherMember, {
      id: otherMember,
      gameId: otherGame,
      accountId: "player",
      removed: false,
    });
    for (const account of ["gm", "player", "outsider"]) state.sessions.set(account, account);
  });
  afterAll(async () => {
    if (!server?.listening) return;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("denies escalation and cross-game removal, then revokes access immediately when the GM removes a player", async () => {
    expect((await request(`/games/${game}/members`, "unknown")).status).toBe(401);
    expect((await request(`/games/${game}/members`, "outsider")).status).toBe(404);
    expect((await request(`/games/${game}/members`, "player")).status).toBe(200);
    expect(
      (await request(`/games/${game}/members/${member}/remove`, "player", "POST")).status,
    ).toBe(403);
    expect(
      (await request(`/games/${game}/members/${otherMember}/remove`, "gm", "POST")).status,
    ).toBe(404);
    expect(state.members.get(member)?.removed).toBe(false);
    expect(state.members.get(otherMember)?.removed).toBe(false);
    expect((await request(`/games/${game}/members/${member}/remove`, "gm", "POST")).status).toBe(
      200,
    );
    expect((await request(`/games/${game}/members`, "player")).status).toBe(404);
    expect((await request(`/games/${otherGame}/members`, "player")).status).toBe(200);
    expect(
      (await request(`/games/${game}/members/${member}/restore`, "player", "POST")).status,
    ).toBe(404);
    expect((await request(`/games/${game}/members/${member}/restore`, "gm", "POST")).status).toBe(
      200,
    );
    expect((await request(`/games/${game}/members`, "player")).status).toBe(200);
  });
});
