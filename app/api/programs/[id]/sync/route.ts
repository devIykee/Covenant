import { NextRequest, NextResponse } from "next/server";
import { reconcileProgram } from "@/src/lib/reconcile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Explicitly advance one program's milestone state machine by (at most) one
// on-chain step. Safe to call repeatedly — reconcile is idempotent and gates
// each step on the previous transaction confirming. Used by a cron/poller or a
// "refresh" affordance; no funds move except automatically per the schedule.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await reconcileProgram(id);
  return NextResponse.json(result);
}
