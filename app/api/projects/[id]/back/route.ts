import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getCustodianAddress } from "@/src/lib/escrow";
import { getExplorerTxUrl } from "@/src/lib/flowvault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { amount, principal, depositTxid, depositExplorerUrl } = await req.json();

  if (!amount || !principal) {
    return NextResponse.json({ error: "Missing amount or principal" }, { status: 400 });
  }

  const project = await db.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Only record a real on-chain transfer id. Never fabricate one.
  const finalTxid = typeof depositTxid === "string" && depositTxid ? depositTxid : null;
  const finalExplorer = finalTxid ? (depositExplorerUrl || getExplorerTxUrl(finalTxid)) : null;

  const contribution = await db.backerContribution.create({
    data: {
      projectId: id,
      principal,
      amount: String(amount),
      depositTxid: finalTxid,
      depositExplorerUrl: finalExplorer,
    },
  });

  // Update status if first backer
  if (project.status === "CREATED") {
    await db.project.update({ where: { id }, data: { status: "BACKING_OPEN" } });
    await db.projectStateLog.create({ data: { projectId: id, status: "BACKING_OPEN", note: "First backing contribution" } });
  }

  const address = await getCustodianAddress();

  return NextResponse.json({
    contribution,
    depositTx: {
      txid: finalTxid,
      explorerUrl: finalExplorer,
    },
    custodian: address,
  });
}
