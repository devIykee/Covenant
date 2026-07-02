import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = process.env.TURSO_DATABASE_URL
  ? new PrismaLibSql({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : new PrismaLibSql({ url: process.env.DATABASE_URL || "file:./dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  await db.project.upsert({
    where: { id: "demo-seed-001" },
    update: {},
    create: {
      id: "demo-seed-001",
      title: "Artemis Liquidity Pool",
      description: "Establishing a decentralized treasury reserve for the Artemis protocol.",
      fundingGoal: "1000000000",
      milestoneDescription: "Complete Phase 1 smart contract audits and deploy to testnet.",
      deadlineBlock: 450000,
      builderAddress: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
      treasuryAddress: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
      status: "BACKING_OPEN",
    },
  });
  console.log("Seed complete");
}

main().then(() => process.exit(0));
