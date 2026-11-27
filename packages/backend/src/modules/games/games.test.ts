import { describe, expect, it } from "vite-plus/test";
import { validateGame } from "./contract.ts";

describe("game input", () => {
  it.each([
    [{ name: "  Adventure  ", systemId: "fabula-ultima" }, "Adventure", {}],
    [
      { name: "   ", systemId: "unknown" },
      "",
      { name: "name_required", systemId: "system_required" },
    ],
    [{ name: "a".repeat(21), systemId: "fabula-ultima" }, "a".repeat(21), { name: "name_length" }],
  ])("validates %j", (input, name, fields) => {
    expect(validateGame(input)).toMatchObject({ name, fields });
  });
});
