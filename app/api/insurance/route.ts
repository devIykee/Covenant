import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { title, returnOnExpiry } = await req.json();
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

    const pool = await db.insurancePool.create({
      data: {
        title,
        triggerCondition: "INCIDENT_DECLARED",
        returnOnExpiry: returnOnExpiry === "ROLL" ? "ROLL" : "REFUND",
        status: "OPEN",
      },
    });
    return NextResponse.json(pool);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create pool" }, { status: 500 });
  }
}

export async function GET() {
  const pools = await db.insurancePool
    .findMany({ orderBy: { createdAt: "desc" }, include: { contributions: { orderBy: { createdAt: "asc" } } } })
    .catch(() => []);
  return NextResponse.json(pools);
}
