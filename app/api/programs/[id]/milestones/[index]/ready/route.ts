import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { eqAddr } from "@/src/lib/address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The builder marks the ACTIVE milestone as ready for judge review. This is a
// lightweight signal (no funds move) that flips the milestone from LOCKED to
// READY_FOR_REVIEW so judges know to look. Only the awarded builder may call it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const milestoneIndex = Number(index);
  const { builderAddress } = await req.json().catch(() => ({}));

  const db = getDb();
  const program = await db.grantProgram.findUnique({
    where: { id },
    include: { award: { include: { milestones: { orderBy: { index: "asc" } } } } },
  });
  if (!program || !program.award) return NextResponse.json({ error: "No active award for this program." }, { status: 404 });
  const award = program.award;

  if (!builderAddress || !eqAddr(builderAddress, award.builderAddress)) {
    return NextResponse.json({ error: "Only the awarded builder can mark a milestone ready." }, { status: 403 });
  }
  if (milestoneIndex !== award.activeMilestoneIndex) {
    return NextResponse.json({ error: "Only the currently-active milestone can be marked ready." }, { status: 400 });
  }
  const milestone = award.milestones.find((m) => m.index === milestoneIndex);
  if (!milestone) return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
  if (milestone.status !== "LOCKED") {
    return NextResponse.json({ error: `Milestone is already ${milestone.status}.` }, { status: 400 });
  }

  await db.milestone.update({ where: { id: milestone.id }, data: { status: "READY_FOR_REVIEW" } });
  return NextResponse.json({ ok: true });
}
