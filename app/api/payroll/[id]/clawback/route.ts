import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { transferToken } from "@/src/lib/escrow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Contributor missed a check-in: claw the remaining (undisbursed) budget back to
// the payer via a real SIP-010 transfer. If the payer address is unknown, we just
// mark it clawed back (funds stay in the custodian).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const vault = await db.payrollVault.findUnique({ where: { id } });
  if (!vault) return NextResponse.json({ error: "Payroll vault not found" }, { status: 404 });
  if (vault.status !== "ACTIVE") {
    return NextResponse.json({ error: `This payroll is already ${vault.status.toLowerCase()}.` }, { status: 400 });
  }

  const remaining = BigInt(vault.totalBudget) - BigInt(vault.releasedAmount || "0");
  if (remaining <= BigInt(0)) {
    await db.payrollVault.update({ where: { id }, data: { status: "COMPLETED" } });
    return NextResponse.json({ error: "Nothing left to claw back." }, { status: 400 });
  }

  const payerIsAddr = /^S[TP][0-9A-Z]{38,40}$/.test(vault.payerAddress);

  try {
    let txid: string | null = null;
    let explorerUrl: string | null = null;

    if (payerIsAddr) {
      const res = await transferToken(vault.payerAddress, remaining.toString(), `Payroll ${id} clawback`);
      txid = res.txid;
      explorerUrl = res.explorerUrl;
    }

    await db.payrollVault.update({
      where: { id },
      data: { status: "CLAWBACK", clawbackTxid: txid, clawbackExplorerUrl: explorerUrl },
    });

    return NextResponse.json({ ok: true, clawedBack: remaining.toString(), txid, explorerUrl, refundedToPayer: payerIsAddr });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Clawback failed" }, { status: 500 });
  }
}
