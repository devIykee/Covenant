// Covenant — Turso setup helper (no CLI needed)
//
// Loads the database schema into your Turso database and verifies the tables,
// using Turso's HTTPS API. Safe to run multiple times (CREATE ... IF NOT EXISTS).
//
// Usage:
//   node scripts/setup-turso.mjs "<TURSO_DATABASE_URL>" "<TURSO_AUTH_TOKEN>"
//
// Example:
//   node scripts/setup-turso.mjs "libsql://covenant-deviykee.turso.io" "eyJhbGci..."
//
// Get the token from the Turso dashboard: your database -> "Generate Token".

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rawUrl = process.argv[2] || process.env.TURSO_DATABASE_URL;
const token = process.argv[3] || process.env.TURSO_AUTH_TOKEN;

if (!rawUrl || !token) {
  console.error("\nMissing arguments.\n");
  console.error('Usage: node scripts/setup-turso.mjs "<TURSO_DATABASE_URL>" "<TURSO_AUTH_TOKEN>"\n');
  process.exit(1);
}

// Normalize libsql://host -> https://host, and strip any accidental region segment
// (e.g. covenant-deviykee.aws-eu-west-1.turso.io -> covenant-deviykee.turso.io).
let host = rawUrl.replace(/^libsql:\/\//, "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
host = host.replace(/\.aws-[a-z0-9-]+\.turso\.io$/, ".turso.io");
const httpBase = `https://${host}`;
const canonicalLibsqlUrl = `libsql://${host}`;

async function pipeline(statements) {
  const requests = statements.map((sql) => ({ type: "execute", stmt: { sql } }));
  requests.push({ type: "close" });
  const res = await fetch(`${httpBase}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected response: ${text.slice(0, 300)}`);
  }
  // Surface any per-statement errors.
  for (const r of json.results || []) {
    if (r.type === "error") {
      throw new Error(`SQL error: ${r.error?.message || JSON.stringify(r.error)}`);
    }
  }
  return json;
}

function loadSchemaStatements() {
  const sql = readFileSync(join(__dirname, "..", "schema.sql"), "utf8");
  return sql
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean)
    // Make it safe to re-run.
    .map((s) => s.replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS "))
    .map((s) => s.replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS "))
    .map((s) => s.replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS "));
}

// Idempotent column migrations for databases created before a column existed.
// SQLite errors with "duplicate column name" if it's already there — we ignore that.
const MIGRATIONS = [
  `ALTER TABLE "Project" ADD COLUMN "judges" TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "PayrollVault" ADD COLUMN "releasedAmount" TEXT NOT NULL DEFAULT '0'`,
  `ALTER TABLE "PayrollVault" ADD COLUMN "clawbackExplorerUrl" TEXT`,
  `ALTER TABLE "CheckIn" ADD COLUMN "amount" TEXT`,
  `ALTER TABLE "CheckIn" ADD COLUMN "explorerUrl" TEXT`,
  `ALTER TABLE "ReputationVault" ADD COLUMN "resolvedExplorerUrl" TEXT`,
  `ALTER TABLE "ReputationVault" ADD COLUMN "payouts" TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "InsurancePool" ADD COLUMN "resolvedExplorerUrl" TEXT`,
  `ALTER TABLE "InsurancePool" ADD COLUMN "payouts" TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "InsuranceContribution" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "PayrollVault" ADD COLUMN "depositTxid" TEXT`,
  `ALTER TABLE "PayrollVault" ADD COLUMN "depositExplorerUrl" TEXT`,
  `ALTER TABLE "ReputationVault" ADD COLUMN "depositTxid" TEXT`,
  `ALTER TABLE "ReputationVault" ADD COLUMN "depositExplorerUrl" TEXT`,
  `ALTER TABLE "InsuranceContribution" ADD COLUMN "depositTxid" TEXT`,
  `ALTER TABLE "InsuranceContribution" ADD COLUMN "depositExplorerUrl" TEXT`,
  `ALTER TABLE "Project" ADD COLUMN "minFundingBps" INTEGER NOT NULL DEFAULT 10000`,
  `ALTER TABLE "Project" ADD COLUMN "builderAcceptedPartial" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "BackerContribution" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE'`,
  `ALTER TABLE "BackerContribution" ADD COLUMN "refundTxid" TEXT`,
  `ALTER TABLE "BackerContribution" ADD COLUMN "refundExplorerUrl" TEXT`,
];

async function runMigrations() {
  for (const sql of MIGRATIONS) {
    try {
      await pipeline([sql]);
      console.log("Applied migration:", sql.slice(0, 60), "...");
    } catch (e) {
      if (/duplicate column/i.test(e.message)) {
        console.log("Migration already applied (ok):", sql.slice(0, 45), "...");
      } else {
        throw e;
      }
    }
  }
}

async function listTables() {
  const json = await pipeline([
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ]);
  const rows = json.results?.[0]?.response?.result?.rows || [];
  return rows.map((r) => r[0]?.value).filter(Boolean);
}

(async () => {
  console.log(`\nConnecting to ${httpBase} ...`);

  const before = await listTables();
  console.log(`Tables before: ${before.length ? before.join(", ") : "(none)"}`);

  console.log("Loading schema (idempotent) ...");
  await pipeline(loadSchemaStatements());

  console.log("Applying column migrations (idempotent) ...");
  await runMigrations();

  const after = await listTables();
  console.log(`\n✅ Done. Tables now (${after.length}): ${after.join(", ")}`);

  console.log("\n────────────────────────────────────────────────");
  console.log("Paste these into Vercel -> Settings -> Environment Variables:");
  console.log("────────────────────────────────────────────────");
  console.log(`TURSO_DATABASE_URL=${canonicalLibsqlUrl}`);
  console.log(`TURSO_AUTH_TOKEN=${token}`);
  console.log("(and STACKS_PRIVATE_KEY = your funded custodian key)");
  console.log("Then click Redeploy.\n");
})().catch((e) => {
  console.error(`\n❌ Failed: ${e.message}\n`);
  console.error("Double-check the token (regenerate it in the Turso dashboard if unsure)");
  console.error("and that the URL host is <db>-<org>.turso.io (no region segment).\n");
  process.exit(1);
});
