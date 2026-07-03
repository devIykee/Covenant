import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { reconcileProgram } from "@/src/lib/reconcile";
import { getCurrentBlockHeight } from "@/src/lib/flowvault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Full detail for one program. Opportunistically advances the milestone state
// machine (automatic disbursement / expiry) before returning, so a visitor
// loading the page is enough to move an AWARDED program forward.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const exists = await db.grantProgram.findUnique({ where: { id }, select: { status: true } });
  if (!exists) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  if (exists.status === "AWARDED") {
    try {
      await reconcileProgram(id);
    } catch {
      /* best effort */
    }
  }

  const program = await db.grantProgram.findUnique({
    where: { id },
    include: {
      applications: { orderBy: { createdAt: "asc" } },
      award: {
        include: {
          milestones: { orderBy: { index: "asc" }, include: { attestations: true } },
          distributions: { orderBy: { createdAt: "asc" } },
        },
      },
      stateLogs: { orderBy: { timestamp: "asc" } },
    },
  });

  let currentBlock = 0;
  try {
    currentBlock = await getCurrentBlockHeight();
  } catch {
    currentBlock = 0;
  }

  return NextResponse.json({ ...program, currentBlock });
}
