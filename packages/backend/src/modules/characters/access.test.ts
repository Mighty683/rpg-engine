import { describe, expect, it } from "vite-plus/test";
import { canEditCharacter } from "./access.ts";

describe("character access policy", () => {
  it("allows the GM and the assigned player but rejects another or GM-controlled sheet", () => {
    const gm = { role: "GM", membershipId: null } as const;
    const player = { role: "Player", membershipId: "mira" } as const;
    expect(canEditCharacter(gm, null)).toBe(true);
    expect(canEditCharacter(gm, "other")).toBe(true);
    expect(canEditCharacter(player, "mira")).toBe(true);
    expect(canEditCharacter(player, "other")).toBe(false);
    expect(canEditCharacter(player, null)).toBe(false);
  });
});
