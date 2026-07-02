import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The builder accepts a raise that's below their minimum, allowing the covenant to
// proceed (be pooled/locked) with whatever was raised. Only the builder may do this.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { builder } = await req.json();

  const project = await db.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Covenant not found" }, { status: 404 });

  if (builder !== project.builderAddress) {
    return NextResponse.json({ error: "Only the builder can accept a partial raise." }, { status: 403 });
  }
  if (!["CREATED", "BACKING_OPEN"].includes(project.status)) {
    return NextResponse.json({ error: "This covenant has already moved past the funding phase." }, { status: 400 });
  }

  await db.project.update({ where: { id }, data: { builderAcceptedPartial: true } });
  await db.projectStateLog.create({
    data: { projectId: id, status: project.status, note: "Builder accepted partial funding to proceed" },
  });

  return NextResponse.json({ ok: true });
}
