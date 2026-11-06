import { describe, expect, it } from "vite-plus/test";
import { newUuid } from "./uuid.ts";

describe("newUuid", () => {
  it("generates unique RFC 4122 v4 UUIDs without crypto.randomUUID", () => {
    const seen = new Set<string>();
    for (let index = 0; index < 500; index++) {
      const id = newUuid();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      seen.add(id);
    }
    expect(seen.size).toBe(500);
  });
});
