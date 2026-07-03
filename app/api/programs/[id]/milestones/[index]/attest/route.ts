import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { verifyMessageSignatureRsv } from "@stacks/encryption";
import { getAddressFromPublicKey } from "@stacks/transactions";
import { FLOWVAULT_NETWORK } from "@/src/lib/flowvault";
import { eqAddr, includesAddr } from "@/src/lib/address";
import { reconcileProgram } from "@/src/lib/reconcile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A named judge cryptographically attests whether the ACTIVE milestone was met.
// The vote is only accepted for the currently-active milestone (sequential),
// from an invited judge, with a signature that matches their address. Reaching
// the MET threshold doesn't move money here — the reconcile engine disburses the
// tranche automatically once the milestone's deadline arrives.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const milestoneIndex = Number(index);
  const { judge, vote, signature, publicKey } = await req.json().catch(() => ({}));

  if (!judge || !vote || !signature || !publicKey) {
    return NextResponse.json({ error: "Missing judge, vote, signature, or publicKey." }, { status: 400 });
  }
  if (!["MET", "NOT_MET"].includes(vote)) {
    return NextResponse.json({ error: "Vote must be MET or NOT_MET." }, { status: 400 });
  }

  const db = getDb();
  const program = await db.grantProgram.findUnique({
    where: { id },
    include: { award: { include: { milestones: { orderBy: { index: "asc" } } } } },
  });
  if (!program || !program.award) return NextResponse.json({ error: "No active award for this program." }, { status: 404 });
  const award = program.award;

  let judges: string[] = [];
  try {
    judges = JSON.parse(award.judges || "[]");
  } catch {
    judges = [];
  }
  if (!includesAddr(judges, judge)) {
    return NextResponse.json({ error: "This address is not an invited judge for this award." }, { status: 403 });
  }

  // Sequential guard: only the active milestone can be attested.
  if (milestoneIndex !== award.activeMilestoneIndex) {
    return NextResponse.json({ error: "Only the currently-active milestone can be attested." }, { status: 400 });
  }
  const milestone = award.milestones.find((m) => m.index === milestoneIndex);
  if (!milestone) return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
  if (["PAID", "EXPIRED"].includes(milestone.status)) {
    return NextResponse.json({ error: `Milestone already ${milestone.status}.` }, { status: 400 });
  }

  // Verify the vote was signed by the wallet that owns `judge`. The message is
  // reconstructed server-side so a client can't sign a different one.
  const message = `Covenant ${id} milestone ${milestoneIndex}: ${vote}`;
  let valid = false;
  try {
    valid = verifyMessageSignatureRsv({ message, signature, publicKey });
  } catch {
    valid = false;
  }
  if (!valid) return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });

  let signer = "";
  try {
    signer = getAddressFromPublicKey(publicKey, FLOWVAULT_NETWORK);
  } catch {
    signer = "";
  }
  if (!eqAddr(signer, judge)) {
    return NextResponse.json({ error: "Signature does not match the judge's address." }, { status: 401 });
  }

  await db.milestoneAttestation.upsert({
    where: { milestoneId_judge: { milestoneId: milestone.id, judge } },
    create: { milestoneId: milestone.id, judge, vote, signature },
    update: { vote, signature },
  });

  // Reflect progress in the milestone status for display (money still moves only
  // at the deadline, via reconcile).
  const atts = await db.milestoneAttestation.findMany({ where: { milestoneId: milestone.id } });
  const threshold = Math.min(2, judges.length);
  const metCount = atts.filter((a) => a.vote === "MET" && includesAddr(judges, a.judge)).length;
  if (metCount >= threshold && !["PAID", "EXPIRED"].includes(milestone.status)) {
    await db.milestone.update({ where: { id: milestone.id }, data: { status: "ATTESTED_MET" } });
  }

  // Best-effort: if the deadline has already passed, this may trigger the payout.
  reconcileProgram(id).catch(() => {});

  return NextResponse.json({ ok: true, metCount, threshold, totalJudges: judges.length });
}
