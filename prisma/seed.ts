import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = process.env.TURSO_DATABASE_URL
  ? new PrismaLibSql({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : new PrismaLibSql({ url: process.env.DATABASE_URL || "file:./dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  await db.grantProgram.upsert({
    where: { id: "demo-seed-001" },
    update: {},
    create: {
      id: "demo-seed-001",
      title: "Artemis Protocol Developer Grant",
      description: "Funding one builder to ship Phase 1 of the Artemis liquidity tooling on testnet.",
      conditions: "Open to Clarity developers with prior testnet deployments. Must ship open-source.",
      grantorAddress: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
      totalPool: "1000000000",
      programDeadlineBlock: 450000,
      status: "DRAFT",
    },
  });
  console.log("Seed complete");
}

main().then(() => process.exit(0));
