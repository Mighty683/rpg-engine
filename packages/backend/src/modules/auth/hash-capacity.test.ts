import { describe, expect, it } from "vite-plus/test";
import { withPasswordHashCapacity } from "./hash-capacity.ts";

describe("password hashing capacity", () => {
  it("limits concurrent operations and releases capacity on success and failure", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const jobs = Array.from({ length: 4 }, () => withPasswordHashCapacity(() => gate));
    await expect(withPasswordHashCapacity(async () => {})).rejects.toMatchObject({
      code: "auth_busy",
    });
    release();
    await Promise.all(jobs);
    await expect(
      withPasswordHashCapacity(async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    await expect(withPasswordHashCapacity(async () => 42)).resolves.toBe(42);
  });
});
