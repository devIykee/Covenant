import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { transferToken } from "@/src/lib/escrow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Distribute the pooled amount to participants by their computed reputation share,
// via real SIP-010 transfers from the custodian. Bumps each participant's reputation.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const vault = await db.reputationVault.findUnique({ where: { id }, include: { participants: true } });
  if (!vault) return NextResponse.json({ error: "Reputation vault not found" }, { status: 404 });
  if (vault.status !== "OPEN") return NextResponse.json({ error: `Already ${vault.status.toLowerCase()}.` }, { status: 400 });

  const total = BigInt(vault.totalAmount);
  const payouts: { recipient: string; amount: string; txid: string; explorerUrl: string }[] = [];

  try {
    let distributed = BigInt(0);
    for (let i = 0; i < vault.participants.length; i++) {
      const p = vault.participants[i];
      const isLast = i === vault.participants.length - 1;
      // Last participant absorbs the rounding remainder so the full pool is paid out.
      const amount = isLast ? total - distributed : (total * BigInt(p.computedShareBps)) / BigInt(10000);
      distributed += amount;
      if (amount <= BigInt(0)) continue;
      const { txid, explorerUrl } = await transferToken(p.principal, amount.toString(), `Reputation vault ${id} payout`);
      payouts.push({ recipient: p.principal, amount: amount.toString(), txid, explorerUrl });
    }

    // Reputation grows for a successful distribution.
    for (const p of vault.participants) {
      await db.reputation.upsert({
        where: { principal: p.principal },
        create: { principal: p.principal, score: 1 },
        update: { score: { increment: 1 } },
      });
    }

    await db.reputationVault.update({
      where: { id },
      data: {
        status: "DISTRIBUTED",
        resolvedTxid: payouts[0]?.txid || null,
        resolvedExplorerUrl: payouts[0]?.explorerUrl || null,
        payouts: JSON.stringify(payouts),
      },
    });

    return NextResponse.json({ ok: true, payouts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Distribution failed", partialPayouts: payouts }, { status: 500 });
  }
}
