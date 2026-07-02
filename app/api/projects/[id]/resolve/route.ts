import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { withdrawFromVault, transferToken, computeProRataShares, getCustodianAddress } from "@/src/lib/escrow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { success } = await req.json(); // boolean

  const project = await db.project.findUnique({
    where: { id },
    include: { contributions: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalPooled = project.contributions.reduce((s, c) => s + BigInt(c.amount), BigInt(0));
  if (totalPooled === BigInt(0)) return NextResponse.json({ error: "No funds to resolve" }, { status: 400 });

  try {
    // Step 1: Custodian withdraws unlocked funds (only if lock passed in real)
    const { txid: withdrawTxid, explorerUrl: withdrawUrl } = await withdrawFromVault(totalPooled.toString(), `project-${id}`);

    await db.project.update({
      where: { id },
      data: {
        withdrawTxid,
        withdrawExplorerUrl: withdrawUrl,
        status: success ? "RESOLVED_SUCCESS" : "RESOLVED_FAILURE",
      },
    });

    await db.projectStateLog.create({
      data: { projectId: id, status: success ? "RESOLVED_SUCCESS" : "RESOLVED_FAILURE", txid: withdrawTxid, note: "Custodian withdrew from FlowVault" },
    });

    const txids: string[] = [withdrawTxid];

    if (success) {
      // 80% to builder, 20% pro-rata to backers
      const builderShare = (totalPooled * BigInt(80)) / BigInt(100);
      const backerShare = totalPooled - builderShare;

      // Builder payout
      const bTx = await transferToken(project.treasuryAddress, builderShare.toString(), `Covenant ${id} builder payout`);
      txids.push(bTx.txid);

      await db.distribution.create({
        data: { projectId: id, recipient: project.treasuryAddress, amount: builderShare.toString(), txid: bTx.txid, explorerUrl: bTx.explorerUrl, kind: "BUILDER_PAYOUT" },
      });

      // Pro-rata to backers
      const shares = computeProRataShares(project.contributions, backerShare.toString());
      for (const s of shares) {
        if (BigInt(s.share) > BigInt(0)) {
          const t = await transferToken(s.principal, s.share, `Covenant ${id} reward`);
          txids.push(t.txid);
          await db.distribution.create({
            data: { projectId: id, recipient: s.principal, amount: s.share, txid: t.txid, explorerUrl: t.explorerUrl, kind: "BACKER_REWARD" },
          });
        }
      }
    } else {
      // Full refund pro-rata
      for (const c of project.contributions) {
        const t = await transferToken(c.principal, c.amount, `Covenant ${id} refund`);
        txids.push(t.txid);
        await db.distribution.create({
          data: { projectId: id, recipient: c.principal, amount: c.amount, txid: t.txid, explorerUrl: t.explorerUrl, kind: "REFUND" },
        });
      }
    }

    // Bump reputation for all participants
    const allPrincipals = new Set<string>([project.builderAddress, ...project.contributions.map(c => c.principal)]);
    for (const p of allPrincipals) {
      await db.reputation.upsert({
        where: { principal: p },
        create: { principal: p, score: 1 },
        update: { score: { increment: 1 } },
      });
    }

    return NextResponse.json({ ok: true, txids, withdrawUrl });
  } catch (e: any) {
    return NextResponse.json({ error: "Resolution failed: " + e.message }, { status: 500 });
  }
}
