import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { eqAddr } from "@/src/lib/address";
import { fundGasForProgram, getProgramCustodianAddress } from "@/src/lib/escrow";
import { reconcileProgram } from "@/src/lib/reconcile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface MilestoneInput {
  name: string;
  description?: string;
  percentBps: number;   // basis points; must sum to 10000
  deadlineBlock: number; // absolute block; must be strictly increasing
  deadlineAt?: string;
}

// The grantor accepts ONE application and, in the same step, defines that award's
// sequential milestone schedule. This:
//   1. creates the Award + Milestone rows (tranche amounts derived from the pool),
//   2. gas-funds the per-program custodian so it can transact, and
//   3. places the FIRST FlowVault lock (whole pool, until milestone #1's deadline).
// From here the reconcile engine drives everything automatically.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { grantorAddress, applicationId, judges, milestones, initialBps: initialBpsRaw } = body as {
    grantorAddress?: string;
    applicationId?: string;
    judges?: string[];
    milestones?: MilestoneInput[];
    initialBps?: number;
  };

  const db = getDb();
  const program = await db.grantProgram.findUnique({ where: { id }, include: { applications: true, award: true } });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  if (!grantorAddress || !eqAddr(grantorAddress, program.grantorAddress)) {
    return NextResponse.json({ error: "Only the grantor can award this program." }, { status: 403 });
  }
  if (program.status !== "FUNDED_OPEN") {
    return NextResponse.json({ error: `Program must be open to award (currently ${program.status}).` }, { status: 400 });
  }
  if (program.award) {
    return NextResponse.json({ error: "This program has already been awarded." }, { status: 400 });
  }

  const application = program.applications.find((a) => a.id === applicationId);
  if (!application) return NextResponse.json({ error: "Application not found for this program." }, { status: 404 });

  // --- validate judges ---
  const judgeList = Array.isArray(judges) ? judges.map((j) => String(j).trim()).filter(Boolean) : [];
  if (judgeList.length === 0) {
    return NextResponse.json({ error: "At least one judge is required to attest milestones." }, { status: 400 });
  }

  // --- validate milestone schedule ---
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return NextResponse.json({ error: "Define at least one milestone." }, { status: 400 });
  }
  let bpsSum = 0;
  let prevBlock = 0;
  for (const [i, m] of milestones.entries()) {
    if (!m.name || !m.percentBps || !m.deadlineBlock) {
      return NextResponse.json({ error: `Milestone ${i + 1} needs a name, a percent, and a deadline block.` }, { status: 400 });
    }
    if (m.percentBps <= 0) {
      return NextResponse.json({ error: `Milestone ${i + 1} percent must be positive.` }, { status: 400 });
    }
    if (m.deadlineBlock <= prevBlock) {
      return NextResponse.json({ error: `Milestone deadlines must strictly increase (milestone ${i + 1}).` }, { status: 400 });
    }
    if (m.deadlineBlock > program.programDeadlineBlock) {
      return NextResponse.json({ error: `Milestone ${i + 1} deadline is past the program horizon.` }, { status: 400 });
    }
    prevBlock = m.deadlineBlock;
    bpsSum += m.percentBps;
  }
  // Upfront payment on acceptance: a % of the pool paid immediately, with the
  // milestones splitting the remaining 100%. initial + milestones must equal 100%.
  const initialBps = Math.round(Number(initialBpsRaw) || 0);
  if (initialBps < 0 || initialBps > 9000) {
    return NextResponse.json({ error: "Upfront payment must be between 0% and 90%." }, { status: 400 });
  }
  if (initialBps + bpsSum !== 10000) {
    return NextResponse.json({ error: `Upfront % plus milestone %s must total 100% (got ${(initialBps + bpsSum) / 100}%).` }, { status: 400 });
  }

  // Derive micro amounts. The upfront amount is paid immediately; the remainder is
  // split across milestones (last milestone absorbs rounding so the parts sum exactly).
  const pool = BigInt(program.totalPool);
  const initialAmount = (pool * BigInt(initialBps)) / BigInt(10000);
  const remainder = pool - initialAmount;
  const amounts: string[] = [];
  let allocated = BigInt(0);
  for (let i = 0; i < milestones.length; i++) {
    if (i === milestones.length - 1) {
      amounts.push((remainder - allocated).toString());
    } else {
      const a = (pool * BigInt(milestones[i].percentBps)) / BigInt(10000);
      amounts.push(a.toString());
      allocated += a;
    }
  }

  // --- persist award + milestones (first milestone lock target = its deadline) ---
  const award = await db.award.create({
    data: {
      programId: id,
      applicationId: application.id,
      builderAddress: application.builderAddress,
      amount: program.totalPool,
      judges: JSON.stringify(judgeList),
      status: "ACTIVE",
      activeMilestoneIndex: 0,
      initialBps,
      initialAmount: initialAmount.toString(),
      milestones: {
        create: milestones.map((m, i) => ({
          index: i,
          name: m.name,
          description: m.description || "",
          percentBps: m.percentBps,
          amount: amounts[i],
          deadlineBlock: m.deadlineBlock,
          deadlineAt: m.deadlineAt ? new Date(m.deadlineAt) : null,
          lockUntilBlock: i === 0 ? m.deadlineBlock : 0,
          status: "LOCKED",
        })),
      },
    },
    include: { milestones: { orderBy: { index: "asc" } } },
  });

  await db.$transaction([
    db.application.update({ where: { id: application.id }, data: { status: "ACCEPTED" } }),
    // Reject all other applications for this program.
    db.application.updateMany({
      where: { programId: id, id: { not: application.id }, status: "PENDING" },
      data: { status: "REJECTED" },
    }),
    db.grantProgram.update({ where: { id }, data: { status: "AWARDED" } }),
    db.programStateLog.create({
      data: { programId: id, status: "AWARDED", note: `Awarded to ${application.builderAddress} with ${milestones.length} milestone(s)` },
    }),
  ]);

  // --- on-chain: only gas the custodian here (a master-signed tx, so it can't
  // collide with the custodian's own nonce). Every custodian-signed step — locking
  // the remainder, the upfront payment, and each milestone payout — is performed by
  // the reconcile engine, ONE confirmed transaction at a time, so nothing races an
  // unconfirmed nonce. This is why the lock/upfront no longer fail intermittently.
  const custodian = program.custodianAddress || getProgramCustodianAddress(id);
  await fundGasForProgram(id).catch((e) => console.warn(`[accept ${id}] gas top-up warning:`, e?.message));

  // Kick the engine so setup can begin as soon as gas confirms (best effort).
  reconcileProgram(id).catch(() => {});

  return NextResponse.json({ ok: true, awardId: award.id, custodianAddress: custodian, setupPending: true });
}
