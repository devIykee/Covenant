import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { eqAddr } from "@/src/lib/address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A builder applies to an open program with a pitch. One application per builder
// per program (re-applying updates the existing pitch).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { builderAddress, pitch, contact } = await req.json().catch(() => ({}));

  if (!builderAddress || !pitch) {
    return NextResponse.json({ error: "Missing builderAddress or pitch." }, { status: 400 });
  }

  const db = getDb();
  const program = await db.grantProgram.findUnique({ where: { id }, include: { applications: true } });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });
  if (program.status !== "FUNDED_OPEN") {
    return NextResponse.json({ error: "This program is not open for applications." }, { status: 400 });
  }
  if (eqAddr(builderAddress, program.grantorAddress)) {
    return NextResponse.json({ error: "The grantor cannot apply to their own program." }, { status: 400 });
  }

  const existing = program.applications.find((a) => eqAddr(a.builderAddress, builderAddress));
  const application = existing
    ? await db.application.update({ where: { id: existing.id }, data: { pitch, contact: contact || null } })
    : await db.application.create({
        data: { programId: id, builderAddress, pitch, contact: contact || null, status: "PENDING" },
      });

  return NextResponse.json({ ok: true, application });
}
