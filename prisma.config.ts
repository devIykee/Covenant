import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 moved the datasource connection URL (used by CLI commands like
// `prisma db push` / `migrate`) out of schema.prisma and into this config file.
// The runtime PrismaClient still connects via the better-sqlite3 driver adapter
// (see src/lib/db.ts); this URL is only used by the CLI. We read DATABASE_URL if
// present and fall back to the committed local SQLite file otherwise.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
  migrations: {
    seed: "node prisma/seed.ts",
  },
});
