import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getCurrentBlockHeight } from "@/src/lib/flowvault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDR = /^S[TP][0-9A-Z]{38,40}$/;

// Create a payroll vault. Amounts arrive as whole USDCx and are stored as micro (6dp).
export async function POST(req: NextRequest) {
  try {
    const { payerAddress, contributorAddress, totalBudget, intervalAmount, depositTxid, depositExplorerUrl } = await req.json();

    if (!ADDR.test(contributorAddress || "")) {
      return NextResponse.json({ error: "Enter a valid contributor Stacks address (ST…)." }, { status: 400 });
    }
    const budget = Number(totalBudget);
    const interval = Number(intervalAmount);
    if (!budget || budget <= 0) return NextResponse.json({ error: "Total budget must be greater than 0." }, { status: 400 });
    if (!interval || interval <= 0) return NextResponse.json({ error: "Interval amount must be greater than 0." }, { status: 400 });
    if (interval > budget) return NextResponse.json({ error: "Interval amount cannot exceed the total budget." }, { status: 400 });

    const budgetMicro = BigInt(Math.round(budget * 1_000_000)).toString();
    const intervalMicro = BigInt(Math.round(interval * 1_000_000)).toString();

    const startBlock = await getCurrentBlockHeight().catch(() => 0);

    const vault = await db.payrollVault.create({
      data: {
        payerAddress: ADDR.test(payerAddress || "") ? payerAddress : "custodian",
        contributorAddress,
        totalBudget: budgetMicro,
        intervalAmount: intervalMicro,
        releasedAmount: "0",
        depositTxid: typeof depositTxid === "string" ? depositTxid : null,
        depositExplorerUrl: typeof depositExplorerUrl === "string" ? depositExplorerUrl : null,
        startBlock,
        endBlock: 0,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(vault);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create payroll vault" }, { status: 500 });
  }
}

export async function GET() {
  const vaults = await db.payrollVault
    .findMany({ orderBy: { createdAt: "desc" }, include: { checkIns: { orderBy: { createdAt: "desc" } } } })
    .catch(() => []);
  return NextResponse.json(vaults);
}
