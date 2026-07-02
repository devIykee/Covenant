import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { transferToken } from "@/src/lib/escrow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// An investor withdraws their deposit before funds are locked (e.g. the raise is
// under the builder's minimum, or they change their mind). The custodian refunds
// every ACTIVE contribution of that investor via a real SIP-010 transfer.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { investor } = await req.json();

  if (!investor) return NextResponse.json({ error: "Connect your wallet to withdraw." }, { status: 400 });

  const project = await db.project.findUnique({ where: { id }, include: { contributions: true } });
  if (!project) return NextResponse.json({ error: "Covenant not found" }, { status: 404 });

  if (!["CREATED", "BACKING_OPEN"].includes(project.status)) {
    return NextResponse.json({ error: "Funds are already locked — deposits can no longer be withdrawn here." }, { status: 400 });
  }

  const mine = project.contributions.filter((c) => c.principal === investor && c.status !== "WITHDRAWN");
  if (mine.length === 0) {
    return NextResponse.json({ error: "You have no active deposit to withdraw on this covenant." }, { status: 403 });
  }

  const total = mine.reduce((s, c) => s + BigInt(c.amount), BigInt(0));

  try {
    const { txid, explorerUrl } = await transferToken(investor, total.toString(), `Covenant ${id} deposit withdrawal`);

    for (const c of mine) {
      await db.backerContribution.update({
        where: { id: c.id },
        data: { status: "WITHDRAWN", refundTxid: txid, refundExplorerUrl: explorerUrl },
      });
    }
    await db.projectStateLog.create({
      data: { projectId: id, status: project.status, txid, note: `Investor ${investor.slice(0, 8)}… withdrew deposit` },
    });

    return NextResponse.json({ ok: true, refunded: total.toString(), txid, explorerUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Withdrawal failed" }, { status: 500 });
  }
}
