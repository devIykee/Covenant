import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

let _prisma: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!_prisma) {
    const url = process.env.DATABASE_URL || "file:./dev.db";
    const adapter = new PrismaBetterSqlite3({ url });
    _prisma = global.prisma ?? new PrismaClient({ adapter });
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
