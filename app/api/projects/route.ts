import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      title,
      description,
      fundingGoal,
      milestoneDescription,
      deadlineBlock,
      builderAddress,
      treasuryAddress,
      minFundingBps,
    } = body;

    if (!title || !fundingGoal || !milestoneDescription || !deadlineBlock) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Minimum to proceed, in basis points of the goal (clamp 1%..100%). Judges are
    // NOT set here — investors appoint them after depositing.
    const minBps = Math.min(10000, Math.max(100, Number(minFundingBps) || 10000));

    const project = await db.project.create({
      data: {
        title,
        description: description || "",
        fundingGoal: String(fundingGoal),
        milestoneDescription,
        deadlineBlock: Number(deadlineBlock),
        disputeWindowBlocks: 144, // ~1 day buffer on testnet
        builderAddress: builderAddress || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        treasuryAddress: treasuryAddress || builderAddress || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        judges: "[]",
        minFundingBps: minBps,
        status: "CREATED",
      },
    });

    // Log initial state
    await db.projectStateLog.create({
      data: {
        projectId: project.id,
        status: "CREATED",
        note: "Covenant initialized",
      },
    });

    return NextResponse.json(project);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create project" }, { status: 500 });
  }
}

export async function GET() {
  const projects = await db.project.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(projects);
}
