import pg from "pg";
import { createApp } from "./app.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString });
const port = Number(process.env.PORT ?? 3000);
const server = createApp(pool).listen(port, "127.0.0.1", () =>
  console.log(`Backend listening on http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () =>
    server.close(() => {
      void pool.end();
    }),
  );
}
