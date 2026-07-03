import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Diagnostic endpoint. Reports whether required config is present and whether the
// database connects — WITHOUT exposing any secret values. Safe to keep in prod.
export async function GET() {
  const env = {
    STACKS_PRIVATE_KEY: Boolean(process.env.STACKS_PRIVATE_KEY),
    TURSO_DATABASE_URL: Boolean(process.env.TURSO_DATABASE_URL),
    TURSO_AUTH_TOKEN: Boolean(process.env.TURSO_AUTH_TOKEN),
    NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS: Boolean(process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS),
  };

  const usingTurso = Boolean(process.env.TURSO_DATABASE_URL);

  let database: { ok: boolean; programCount?: number; error?: string };
  try {
    const programCount = await db.grantProgram.count();
    database = { ok: true, programCount };
  } catch (e: any) {
    database = { ok: false, error: e?.message || String(e) };
  }

  let custodianAddress: string | null = null;
  try {
    const { getCustodianAddress } = await import("@/src/lib/escrow");
    custodianAddress = await getCustodianAddress();
  } catch {
    custodianAddress = null;
  }

  const ok = database.ok && env.STACKS_PRIVATE_KEY && (usingTurso ? env.TURSO_AUTH_TOKEN : true);

  return NextResponse.json(
    {
      ok,
      env,
      database,
      dbBackend: usingTurso ? "turso" : "local-sqlite-file",
      custodianAddress,
      hint: !env.STACKS_PRIVATE_KEY
        ? "STACKS_PRIVATE_KEY missing on this deployment — add it in Vercel and Redeploy."
        : !usingTurso
        ? "TURSO_DATABASE_URL not set — on Vercel this must be set (local SQLite can't be written)."
        : !database.ok
        ? "DB not reachable — check TURSO_AUTH_TOKEN / URL, then Redeploy."
        : "All good.",
    },
    { status: ok ? 200 : 503 }
  );
}
