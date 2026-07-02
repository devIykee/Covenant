import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_JUDGES = [
  "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
  "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
  "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { judge, vote, signature } = await req.json();

  if (!judge || !vote || !signature) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (!["MET", "NOT_MET"].includes(vote)) return NextResponse.json({ error: "Bad vote" }, { status: 400 });
  if (!ALLOWED_JUDGES.includes(judge)) return NextResponse.json({ error: "Judge not authorized (demo)" }, { status: 403 });

  const project = await db.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Upsert attestation
  await db.judgeAttestation.upsert({
    where: { projectId_judge: { projectId: id, judge } },
    create: { projectId: id, judge, vote, signature },
    update: { vote, signature },
  });

  // Auto advance if >=2 MET
  const atts = await db.judgeAttestation.findMany({ where: { projectId: id } });
  const metCount = atts.filter(a => a.vote === "MET").length;

  if (metCount >= 2 && !["POOLED_LOCKED", "DISPUTE_WINDOW", "RESOLVED_SUCCESS"].includes(project.status)) {
    // Move to dispute window (locked in real)
    await db.project.update({ where: { id }, data: { status: "DISPUTE_WINDOW" } });
    await db.projectStateLog.create({ data: { projectId: id, status: "DISPUTE_WINDOW", note: "2-of-3 attestations received" } });
  }

  return NextResponse.json({ ok: true, metCount });
}
