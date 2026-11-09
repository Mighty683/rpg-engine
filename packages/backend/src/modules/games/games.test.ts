import { describe, expect, it } from "vite-plus/test";
import { validateGame } from "./service.ts";

describe("game input", () => {
  it.each([
    [{ name: "  Adventure  ", systemId: "fabula-ultima" }, "Adventure", {}],
    [
      { name: "   ", systemId: "unknown" },
      "",
      { name: "Enter a game name", systemId: "Select an RPG system" },
    ],
    [
      { name: "a".repeat(21), systemId: "fabula-ultima" },
      "a".repeat(21),
      { name: "Use 20 characters or fewer" },
    ],
  ])("validates %j", (input, name, fields) => {
    expect(validateGame(input)).toMatchObject({ name, fields });
  });
});
