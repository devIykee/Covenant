import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { transferToken } from "@/src/lib/escrow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Resolve the pool. `triggered=true` => incident declared: distribute the whole pool
// pro-rata to contributors (claimants). `triggered=false` => expiry: refund pro-rata
// (returnOnExpiry=REFUND) or roll the pool over (ROLL). Real SIP-010 transfers.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { triggered } = await req.json();

  const pool = await db.insurancePool.findUnique({ where: { id }, include: { contributions: true } });
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  if (pool.status !== "OPEN") return NextResponse.json({ error: `Pool already ${pool.status.toLowerCase()}.` }, { status: 400 });

  const total = pool.contributions.reduce((s, c) => s + BigInt(c.amount), BigInt(0));
  if (total === BigInt(0)) return NextResponse.json({ error: "No premiums in the pool yet." }, { status: 400 });

  // Roll on expiry: no transfers, keep the pool for the next period.
  if (!triggered && pool.returnOnExpiry === "ROLL") {
    await db.insurancePool.update({ where: { id }, data: { status: "ROLLED" } });
    return NextResponse.json({ ok: true, rolled: true });
  }

  const payouts: { recipient: string; amount: string; txid: string; explorerUrl: string }[] = [];
  try {
    if (triggered) {
      // Incident declared: the whole pool pays out to the claimant (the first
      // registered contributor in this demo). This is the programmable payout.
      const claimant = pool.contributions[0].principal;
      const { txid, explorerUrl } = await transferToken(claimant, total.toString(), `Insurance ${id} claim payout`);
      payouts.push({ recipient: claimant, amount: total.toString(), txid, explorerUrl });
    } else {
      // Expiry with no incident: refund every premium to its payer.
      for (const c of pool.contributions) {
        if (BigInt(c.amount) <= BigInt(0)) continue;
        const { txid, explorerUrl } = await transferToken(c.principal, c.amount, `Insurance ${id} refund`);
        payouts.push({ recipient: c.principal, amount: c.amount, txid, explorerUrl });
      }
    }

    await db.insurancePool.update({
      where: { id },
      data: {
        status: triggered ? "PAID_OUT" : "REFUNDED",
        resolvedTxid: payouts[0]?.txid || null,
        resolvedExplorerUrl: payouts[0]?.explorerUrl || null,
        payouts: JSON.stringify(payouts),
      },
    });

    return NextResponse.json({ ok: true, triggered: !!triggered, payouts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Resolve failed", partialPayouts: payouts }, { status: 500 });
  }
}
