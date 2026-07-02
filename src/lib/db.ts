import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

let _prisma: PrismaClient | undefined;

/**
 * Resolve the database connection.
 *
 * - In production (Vercel) set TURSO_DATABASE_URL (libsql://...) + TURSO_AUTH_TOKEN.
 *   Vercel's filesystem is read-only/ephemeral, so a local SQLite file cannot be
 *   used there — Turso (libSQL) is a hosted, SQLite-compatible database.
 * - Locally, if those vars are absent we fall back to the committed SQLite file.
 *   The libSQL client understands `file:` URLs, so the same adapter serves both.
 */
function makeAdapter(): PrismaLibSql {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    return new PrismaLibSql({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  const url = process.env.DATABASE_URL || "file:./dev.db";
  return new PrismaLibSql({ url });
}

export function getDb(): PrismaClient {
  if (!_prisma) {
    _prisma = global.prisma ?? new PrismaClient({ adapter: makeAdapter() });
    if (process.env.NODE_ENV !== "production") {
      global.prisma = _prisma;
    }
  }
  return _prisma;
}

// Backwards compat export for existing imports (will be phased out)
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});
