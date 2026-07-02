import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDR = /^S[TP][0-9A-Z]{38,40}$/;

// Create a reputation-weighted vault. Split % is computed automatically from each
// participant's reputation score (equal split if nobody has a score yet).
export async function POST(req: NextRequest) {
  try {
    const { title, totalAmount, participants, depositTxid, depositExplorerUrl } = await req.json();

    const list: string[] = Array.isArray(participants)
      ? Array.from(new Set(participants.map((p: string) => (p || "").trim()).filter((p: string) => ADDR.test(p))))
      : [];
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (list.length < 2) return NextResponse.json({ error: "Add at least 2 valid participant addresses." }, { status: 400 });
    const amount = Number(totalAmount);
    if (!amount || amount <= 0) return NextResponse.json({ error: "Total amount must be greater than 0." }, { status: 400 });

    // Look up reputation scores.
    const reps = await db.reputation.findMany({ where: { principal: { in: list } } });
    const scoreOf = (p: string) => reps.find((r) => r.principal === p)?.score ?? 0;
    const scores = list.map(scoreOf);
    const totalScore = scores.reduce((a, b) => a + b, 0);

    // Compute basis-point shares (sum to exactly 10000).
    let shares: number[];
    if (totalScore === 0) {
      const base = Math.floor(10000 / list.length);
      shares = list.map(() => base);
    } else {
      shares = scores.map((s) => Math.floor((s * 10000) / totalScore));
    }
    const drift = 10000 - shares.reduce((a, b) => a + b, 0);
    // Give the rounding remainder to the highest-reputation participant (or the first).
    const topIdx = scores.reduce((best, s, i) => (s > scores[best] ? i : best), 0);
    shares[topIdx] += drift;

    const vault = await db.reputationVault.create({
      data: {
        title,
        totalAmount: BigInt(Math.round(amount * 1_000_000)).toString(),
        status: "OPEN",
        depositTxid: typeof depositTxid === "string" ? depositTxid : null,
        depositExplorerUrl: typeof depositExplorerUrl === "string" ? depositExplorerUrl : null,
        participants: {
          create: list.map((principal, i) => ({
            principal,
            reputationAtTime: scores[i],
            computedShareBps: shares[i],
          })),
        },
      },
      include: { participants: true },
    });

    return NextResponse.json(vault);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create reputation vault" }, { status: 500 });
  }
}

export async function GET() {
  const vaults = await db.reputationVault
    .findMany({ orderBy: { createdAt: "desc" }, include: { participants: true } })
    .catch(() => []);
  return NextResponse.json(vaults);
}
