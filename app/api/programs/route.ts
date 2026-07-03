import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { getProgramCustodianAddress } from "@/src/lib/escrow";
import { reconcileAllActive } from "@/src/lib/reconcile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Create a new grant program (DRAFT). The grantor must fund + lock the pool
// (via /api/programs/[id]/fund) before it becomes publicly listed (FUNDED_OPEN).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, conditions, grantorAddress, totalPool, programDeadlineBlock, programDeadlineAt } = body;

    if (!title || !grantorAddress || !totalPool || !programDeadlineBlock) {
      return NextResponse.json({ error: "Missing required fields (title, grantorAddress, totalPool, programDeadlineBlock)" }, { status: 400 });
    }
    if (BigInt(String(totalPool)) <= BigInt(0)) {
      return NextResponse.json({ error: "Pool must be greater than zero." }, { status: 400 });
    }

    const program = await getDb().grantProgram.create({
      data: {
        title,
        description: description || "",
        conditions: conditions || "",
        grantorAddress,
        totalPool: String(totalPool),
        programDeadlineBlock: Number(programDeadlineBlock),
        programDeadlineAt: programDeadlineAt ? new Date(programDeadlineAt) : null,
        status: "DRAFT",
      },
    });

    // Derive + persist the dedicated per-program escrow custodian address so the
    // grantor knows exactly where to send the pool. (Private key is never stored.)
    const custodianAddress = getProgramCustodianAddress(program.id);
    await getDb().grantProgram.update({ where: { id: program.id }, data: { custodianAddress } });

    await getDb().programStateLog.create({
      data: { programId: program.id, status: "DRAFT", note: "Program created — awaiting funding" },
    });

    return NextResponse.json({ ...program, custodianAddress });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create program" }, { status: 500 });
  }
}

// List publicly-visible programs. Opportunistically advances any AWARDED program's
// milestone state machine (automatic disbursement / expiry) — best effort.
export async function GET() {
  try {
    await reconcileAllActive();
  } catch {
    /* best effort — never block the list on a reconcile hiccup */
  }
  const programs = await getDb().grantProgram.findMany({
    where: { status: { in: ["FUNDED_OPEN", "AWARDED", "COMPLETED", "EXPIRED"] } },
    orderBy: { createdAt: "desc" },
    include: { applications: true, award: true },
  });
  return NextResponse.json(programs);
}
