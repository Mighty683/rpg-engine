import type { GameAccessRepository } from "./types.ts";
import { describe, expect, it } from "vite-plus/test";
import { resolveGameAccess } from "./service.ts";

class MemoryGameAccessRepository implements GameAccessRepository {
  games = new Map<string, string>();
  memberships = new Map<string, { id: string; removed: boolean }>();

  async findGameAccess(gameId: string, accountId: string) {
    const gmAccountId = this.games.get(gameId);
    if (!gmAccountId) return null;
    const membership = this.memberships.get(`${gameId}:${accountId}`);
    return { gmAccountId, membershipId: membership && !membership.removed ? membership.id : null };
  }
}

const actor = (accountId: string) => ({ accountId, sessionId: "session" });

describe("game access policy", () => {
  it("resolves roles per game and denies missing, foreign, and removed membership", async () => {
    const repository = new MemoryGameAccessRepository();
    repository.games.set("first", "robin");
    repository.games.set("second", "mira");
    repository.memberships.set("first:mira", { id: "mira-member", removed: false });
    repository.memberships.set("second:robin", { id: "robin-member", removed: false });
    expect(await resolveGameAccess(repository, actor("robin"), "first")).toEqual({
      role: "GM",
      membershipId: null,
    });
    expect(await resolveGameAccess(repository, actor("robin"), "second")).toEqual({
      role: "Player",
      membershipId: "robin-member",
    });
    expect(await resolveGameAccess(repository, actor("mira"), "first")).toEqual({
      role: "Player",
      membershipId: "mira-member",
    });
    expect(await resolveGameAccess(repository, actor("ellis"), "first")).toBeNull();
    expect(await resolveGameAccess(repository, actor("robin"), "missing")).toBeNull();
    repository.memberships.set("first:mira", { id: "mira-member", removed: true });
    expect(await resolveGameAccess(repository, actor("mira"), "first")).toBeNull();
    expect(await resolveGameAccess(repository, actor("mira"), "second")).toEqual({
      role: "GM",
      membershipId: null,
    });
  });
});
