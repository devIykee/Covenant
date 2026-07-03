// Delete ALL milestone covenants (and their child rows) from the database.
//
// Usage:
//   node scripts/clear-covenants.mjs           # uses .env (Turso if set, else local dev.db)
//   node scripts/clear-covenants.mjs --all      # also clears Payroll / Reputation / Insurance vaults
//
// Reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (or DATABASE_URL) from .env or the
// environment. The on-chain transactions this app already produced are NOT affected —
// they live on Stacks forever; this only clears the app's off-chain records.

import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith("#")) env[m[1]] = env[m[1]] ?? m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env, use process.env */
  }
  return env;
}

const env = loadEnv();
const url = env.TURSO_DATABASE_URL || env.DATABASE_URL || "file:./dev.db";
const authToken = env.TURSO_DATABASE_URL ? env.TURSO_AUTH_TOKEN : undefined;
const alsoSecondary = process.argv.includes("--all");

const client = createClient(authToken ? { url, authToken } : { url });

async function count(table) {
  try {
    return Number((await client.execute(`SELECT count(*) n FROM "${table}"`)).rows[0].n);
  } catch {
    return 0;
  }
}
async function wipe(table) {
  try {
    const r = await client.execute(`DELETE FROM "${table}"`);
    return r.rowsAffected;
  } catch (e) {
    return `skip (${e.message.slice(0, 40)})`;
  }
}

(async () => {
  console.log(`Target: ${url.replace(/\/\/.*@/, "//…@")}`);
  const before = await count("GrantProgram");
  console.log(`Grant programs before: ${before}`);

  // Children first (FK-safe), then the programs.
  const childTables = ["MilestoneAttestation", "Milestone", "Distribution", "Award", "Application", "ProgramStateLog"];
  for (const t of childTables) console.log(`  ${t}: deleted ${await wipe(t)}`);
  console.log(`  GrantProgram: deleted ${await wipe("GrantProgram")}`);

  if (alsoSecondary) {
    console.log("Also clearing secondary vaults (--all):");
    for (const t of ["CheckIn", "PayrollVault", "ReputationVaultParticipant", "ReputationVault", "InsuranceContribution", "InsuranceClaim", "InsurancePool"]) {
      console.log(`  ${t}: deleted ${await wipe(t)}`);
    }
  }

  console.log(`\n✅ Done. Grant programs remaining: ${await count("GrantProgram")}`);
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
