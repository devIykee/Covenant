import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Returns everything relevant to one wallet: campaigns they built, and campaigns
// they invested in. "raised" counts only ACTIVE (non-withdrawn) contributions.
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") || "";
  if (!address) return NextResponse.json({ asBuilder: [], asInvestor: [] });

  const projects = await db.project
    .findMany({ orderBy: { createdAt: "desc" }, include: { contributions: true } })
    .catch(() => []);

  const shape = (p: any) => {
    const active = p.contributions.filter((c: any) => c.status !== "WITHDRAWN");
    const raised = active.reduce((s: bigint, c: any) => s + BigInt(c.amount), BigInt(0));
    const goal = BigInt(p.fundingGoal);
    const minRequired = (goal * BigInt(p.minFundingBps ?? 10000)) / BigInt(10000);
    const metMin = raised >= minRequired || p.builderAcceptedPartial;
    let judges: string[] = [];
    try { judges = JSON.parse(p.judges || "[]"); } catch { judges = []; }
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      fundingGoal: p.fundingGoal,
      minFundingBps: p.minFundingBps ?? 10000,
      builderAcceptedPartial: p.builderAcceptedPartial ?? false,
      builderAddress: p.builderAddress,
      raised: raised.toString(),
      minRequired: minRequired.toString(),
      metMin,
      judgeCount: judges.length,
      investors: active.map((c: any) => ({
        principal: c.principal,
        amount: c.amount,
        depositExplorerUrl: c.depositExplorerUrl,
      })),
    };
  };

  const asBuilder = projects.filter((p: any) => p.builderAddress === address).map(shape);
  const asInvestor = projects
    .filter((p: any) => p.contributions.some((c: any) => c.principal === address))
    .map((p: any) => {
      const base = shape(p);
      const mine = p.contributions.filter((c: any) => c.principal === address);
      const myActive = mine
        .filter((c: any) => c.status !== "WITHDRAWN")
        .reduce((s: bigint, c: any) => s + BigInt(c.amount), BigInt(0));
      const myWithdrawn = mine.some((c: any) => c.status === "WITHDRAWN");
      return { ...base, myContribution: myActive.toString(), myWithdrawn };
    });

  return NextResponse.json({ asBuilder, asInvestor });
}
