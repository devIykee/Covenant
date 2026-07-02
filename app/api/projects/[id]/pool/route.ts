import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { poolIntoVault, getCustodianAddress } from "@/src/lib/escrow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await db.project.findUnique({ where: { id }, include: { contributions: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const total = project.contributions.reduce((s, c) => s + BigInt(c.amount), BigInt(0)).toString();

  if (BigInt(total) === BigInt(0)) return NextResponse.json({ error: "No contributions" }, { status: 400 });

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
