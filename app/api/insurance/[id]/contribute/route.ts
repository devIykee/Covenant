import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDR = /^S[TP][0-9A-Z]{38,40}$/;

// Record a premium contribution into the pool (tracked; the custodian holds the funds).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { principal, amount, depositTxid, depositExplorerUrl } = await req.json();

  if (!ADDR.test(principal || "")) return NextResponse.json({ error: "Enter a valid Stacks address." }, { status: 400 });
  const amt = Number(amount);
  if (!amt || amt <= 0) return NextResponse.json({ error: "Amount must be greater than 0." }, { status: 400 });

  const pool = await db.insurancePool.findUnique({ where: { id } });
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  if (pool.status !== "OPEN") return NextResponse.json({ error: "Pool is closed to new premiums." }, { status: 400 });

  const contribution = await db.insuranceContribution.create({
    data: { poolId: id, principal, amount: BigInt(Math.round(amt * 1_000_000)).toString() },
  });
  return NextResponse.json(contribution);
}
