import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { transferToken } from "@/src/lib/escrow";
import { getCurrentBlockHeight } from "@/src/lib/flowvault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Contributor checks in to prove activity — which releases one interval of pay
// to them via a real SIP-010 transfer from the custodian.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const vault = await db.payrollVault.findUnique({ where: { id } });
  if (!vault) return NextResponse.json({ error: "Payroll vault not found" }, { status: 404 });
  if (vault.status !== "ACTIVE") {
    return NextResponse.json({ error: `This payroll is ${vault.status.toLowerCase()}, no further releases.` }, { status: 400 });
  }

  const total = BigInt(vault.totalBudget);
  const released = BigInt(vault.releasedAmount || "0");
  const remaining = total - released;
  if (remaining <= BigInt(0)) {
    await db.payrollVault.update({ where: { id }, data: { status: "COMPLETED" } });
    return NextResponse.json({ error: "Budget fully streamed." }, { status: 400 });
  }

  // Release one interval, or whatever is left if less.
  const interval = BigInt(vault.intervalAmount);
  const payout = interval < remaining ? interval : remaining;

  try {
    const { txid, explorerUrl } = await transferToken(vault.contributorAddress, payout.toString(), `Payroll ${id} release`);

    const block = await getCurrentBlockHeight().catch(() => 0);
    const newReleased = released + payout;
    const done = newReleased >= total;

    await db.payrollVault.update({
      where: { id },
      data: {
        releasedAmount: newReleased.toString(),
        lastReleasedBlock: block,
        status: done ? "COMPLETED" : "ACTIVE",
      },
    });

    await db.checkIn.create({
      data: {
        payrollId: id,
        principal: vault.contributorAddress,
        intervalBlock: block,
        amount: payout.toString(),
        txid,
        explorerUrl,
      },
    });

    return NextResponse.json({ ok: true, txid, explorerUrl, released: newReleased.toString(), done });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Release failed" }, { status: 500 });
  }
}
