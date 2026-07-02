import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { poolIntoVault, getCustodianAddress } from "@/src/lib/escrow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await db.project.findUnique({ where: { id }, include: { contributions: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only ACTIVE (non-withdrawn) contributions count toward the pooled amount.
  const activeContribs = project.contributions.filter((c) => c.status !== "WITHDRAWN");
  const totalBig = activeContribs.reduce((s, c) => s + BigInt(c.amount), BigInt(0));
  const total = totalBig.toString();

  if (totalBig === BigInt(0)) return NextResponse.json({ error: "No active deposits to pool." }, { status: 400 });

  // Judges must be appointed by investors before funds can be locked.
  let appointedJudges: string[] = [];
  try {
    appointedJudges = JSON.parse((project as any).judges || "[]");
  } catch {
    appointedJudges = [];
  }
  if (appointedJudges.length === 0) {
    return NextResponse.json({ error: "Investors must appoint at least one judge before pooling." }, { status: 400 });
  }

  // Funding must reach the builder's minimum, unless the builder accepted a partial raise.
  const goal = BigInt(project.fundingGoal);
  const minRequired = (goal * BigInt((project as any).minFundingBps ?? 10000)) / BigInt(10000);
  if (totalBig < minRequired && !(project as any).builderAcceptedPartial) {
    const pct = Math.round(((project as any).minFundingBps ?? 10000) / 100);
    return NextResponse.json({ error: `Raised ${(Number(total) / 1e6).toFixed(0)} of the ${pct}% minimum (${(Number(minRequired) / 1e6).toFixed(0)} USDCx). Wait for more or accept the partial raise.` }, { status: 400 });
  }

  // Lock 100% until deadline + dispute window
  const lockUntil = project.deadlineBlock + (project.disputeWindowBlocks || 144);

  try {
    const { txid, explorerUrl } = await poolIntoVault(total, {
      lockAmount: total,
      lockUntilBlock: lockUntil,
      splitAddress: null,
      splitAmount: "0",
    }, `milestone-${id}`);

    await db.project.update({
      where: { id },
      data: {
        pooledTxid: txid,
        pooledExplorerUrl: explorerUrl,
        status: "POOLED_LOCKED",
      },
    });

    await db.projectStateLog.create({
      data: { projectId: id, status: "POOLED_LOCKED", txid, note: "Pooled to FlowVault with full lock" },
    });

    return NextResponse.json({ ok: true, txid, explorerUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
