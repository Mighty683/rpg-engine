import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it, vi } from "vite-plus/test";
import { applyMigrations } from "./migrations.ts";

describe("migration runner", () => {
  it("releases the connection if the schema lookup fails", async () => {
    const client = {
      query: vi.fn().mockRejectedValue(new Error("connection failed")),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as pg.Pool;

    await expect(applyMigrations(pool)).rejects.toThrow("connection failed");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("serializes concurrent runners on one schema and records each version once", async () => {
    const connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString) return;
    const admin = new pg.Pool({ connectionString });
    const schema = `migration_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const first = new pg.Pool({ connectionString, max: 1, options: `-c search_path=${schema}` });
    const second = new pg.Pool({ connectionString, max: 1, options: `-c search_path=${schema}` });
    try {
      await Promise.all([applyMigrations(first), applyMigrations(second)]);
      const result = await first.query(
        `SELECT hash, created_at FROM "${schema}"."__drizzle_migrations" ORDER BY created_at`,
      );
      expect(result.rows).toHaveLength(4);
      expect(result.rows.every((row) => row.hash && row.created_at)).toBe(true);
    } finally {
      await first.end();
      await second.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  }, 30_000);
});
