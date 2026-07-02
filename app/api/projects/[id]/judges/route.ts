import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { eqAddr, includesAddr } from "@/src/lib/address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDR = /^S[TP][0-9A-Z]{38,40}$/;

// Investors (and only investors) appoint the judges for a covenant, after they've
// deposited. The builder cannot — they'd be picking their own referees. An investor
// may appoint themselves. Judges can only be set before the funds are locked.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { investor, judges } = await req.json();

  if (!ADDR.test(investor || "")) {
    return NextResponse.json({ error: "Connect your wallet to appoint judges." }, { status: 400 });
  }

  const project = await db.project.findUnique({ where: { id }, include: { contributions: true } });
  if (!project) return NextResponse.json({ error: "Covenant not found" }, { status: 404 });

  if (!["CREATED", "BACKING_OPEN"].includes(project.status)) {
    return NextResponse.json({ error: "Judges can only be appointed before the funds are pooled/locked." }, { status: 400 });
  }

  // Caller must be an investor who has actually deposited into this covenant.
  const isInvestor = project.contributions.some((c) => eqAddr(c.principal, investor) && c.status !== "WITHDRAWN");
  if (!isInvestor) {
    return NextResponse.json({ error: "Only investors who have deposited can appoint judges." }, { status: 403 });
  }

  const incoming: string[] = Array.isArray(judges)
    ? judges.map((j: string) => (j || "").trim()).filter((j: string) => ADDR.test(j))
    : [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: "Provide at least one valid judge address." }, { status: 400 });
  }

  let current: string[] = [];
  try {
    current = JSON.parse((project as any).judges || "[]");
  } catch {
    current = [];
  }
  // Dedup case-insensitively against already-appointed judges.
  const merged = [...current];
  for (const j of incoming) if (!includesAddr(merged, j)) merged.push(j);

  await db.project.update({ where: { id }, data: { judges: JSON.stringify(merged) } });
  await db.projectStateLog.create({
    data: { projectId: id, status: project.status, note: `Investor ${investor.slice(0, 8)}… appointed ${incoming.length} judge(s)` },
  });

  return NextResponse.json({ ok: true, judges: merged });
}
