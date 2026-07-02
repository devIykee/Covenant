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
      judges,
    } = body;

    if (!title || !fundingGoal || !milestoneDescription || !deadlineBlock) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Invited judges: independent verifiers who attest the milestone (2-of-N).
    const judgeList: string[] = Array.isArray(judges)
      ? judges
          .map((j: string) => (typeof j === "string" ? j.trim() : ""))
          .filter((j: string) => /^S[TP][0-9A-Z]{38,40}$/.test(j))
      : [];
    // De-duplicate.
    const uniqueJudges = Array.from(new Set(judgeList));

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
        judges: JSON.stringify(uniqueJudges),
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
