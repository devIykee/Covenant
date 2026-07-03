/**
 * Covenant - Reconcile Engine (automatic milestone disbursement / expiry)
 *
 * This is the heart of the grant model's automation. There is no manual
 * "release funds" button: for a program that has been AWARDED, the reconcile
 * engine advances the milestone state machine on its own whenever it runs
 * (called opportunistically by the program list/detail API routes, or by a
 * cron/sync endpoint).
 *
 * Because FlowVault time-locks cannot release early on a condition — and a
 * principal may hold only ONE active lock — each program uses a dedicated
 * custodian and a STAGED RE-LOCK: the whole remaining pool is locked until the
 * active milestone's deadline; at (or after) that deadline the custodian frees
 * the remaining balance, pays the earned tranche (if judges attested MET) or
 * returns everything to the grantor (if not), then re-locks the leftover until
 * the next milestone's deadline.
 *
 * On-chain steps within a single milestone (withdraw -> pay -> re-lock) each
 * need the previous transaction to confirm, and nonce collisions must be
 * avoided. So reconcile advances AT MOST ONE on-chain transaction per call and
 * gates each step on the prior tx reaching "success". Callers may invoke it
 * repeatedly (it is idempotent and self-limiting).
 */

import { getDb } from "./db";
import {
  withdrawFromProgram,
  transferFromProgram,
  lockPoolForProgram,
  getTxStatus,
} from "./escrow";
import { getCurrentBlockHeight } from "./flowvault";

export interface ReconcileResult {
  programId: string;
  action:
    | "noop"
    | "waiting_deadline"
    | "waiting_confirmation"
    | "paid_initial"
    | "withdrew"
    | "paid_milestone"
    | "relocked"
    | "completed"
    | "expired"
    | "not_awarded"
    | "error";
  detail?: string;
  txid?: string;
}

function sumMicro(values: string[]): bigint {
  return values.reduce((acc, v) => acc + BigInt(v || "0"), BigInt(0));
}

/**
 * Advance one program's milestone state machine by at most one on-chain step.
 * Never throws — on-chain / RPC failures are captured in the result so callers
 * (list/detail routes) don't 500 just because a background reconcile hiccuped.
 */
export async function reconcileProgram(programId: string): Promise<ReconcileResult> {
  const db = getDb();

  const program = await db.grantProgram.findUnique({
    where: { id: programId },
    include: {
      award: {
        include: {
          milestones: { orderBy: { index: "asc" } },
          distributions: true,
        },
      },
    },
  });

  if (!program) return { programId, action: "error", detail: "program not found" };
  if (program.status !== "AWARDED" || !program.award) {
    return { programId, action: "not_awarded" };
  }

  const award = program.award;
  if (award.status !== "ACTIVE") return { programId, action: "not_awarded" };

  // --- Step 0: upfront payment on acceptance (paid once, not deadline-gated) ---
  // The upfront % was never locked — it sits in the custodian's plain balance.
  // Gate it on accept's lock transaction confirming, so the two custodian-signed
  // transactions never collide on a nonce.
  const initialMicro = BigInt(award.initialAmount || "0");
  if (award.initialBps > 0 && initialMicro > BigInt(0) && !award.initialTxid) {
    if (program.lockTxid) {
      const ls = await getTxStatus(program.lockTxid);
      if (ls !== "success") {
        return { programId, action: "waiting_confirmation", detail: `lock ${ls}` };
      }
    }
    try {
      const p = await transferFromProgram(programId, award.builderAddress, award.initialAmount, "Covenant upfront payment");
      await db.$transaction([
        db.award.update({ where: { id: award.id }, data: { initialTxid: p.txid, initialExplorerUrl: p.explorerUrl } }),
        db.distribution.create({
          data: { awardId: award.id, recipient: award.builderAddress, amount: award.initialAmount, txid: p.txid, explorerUrl: p.explorerUrl, kind: "INITIAL_PAYOUT" },
        }),
        db.programStateLog.create({
          data: { programId, status: "AWARDED", note: `Upfront payment (${award.initialBps / 100}%) sent to builder`, txid: p.txid, explorerUrl: p.explorerUrl },
        }),
      ]);
      return { programId, action: "paid_initial", txid: p.txid, detail: "upfront payment sent to builder" };
    } catch (err: any) {
      return { programId, action: "error", detail: err?.message || String(err) };
    }
  }

  const milestones = award.milestones;
  const idx = award.activeMilestoneIndex;
  const active = milestones.find((m) => m.index === idx);
  if (!active) return { programId, action: "noop", detail: "no active milestone" };

  // Already resolved tranche but pointer not advanced — nothing to do here.
  if (active.status === "PAID" || active.status === "EXPIRED") {
    return { programId, action: "noop", detail: "active milestone already resolved" };
  }

  let currentBlock = 0;
  try {
    currentBlock = await getCurrentBlockHeight();
  } catch {
    return { programId, action: "error", detail: "could not read current block" };
  }

  // Payout is deadline-gated: FlowVault can't release before lockUntilBlock.
  if (currentBlock < active.deadlineBlock) {
    return { programId, action: "waiting_deadline", detail: `block ${currentBlock}/${active.deadlineBlock}` };
  }

  // Did the judges attest this milestone MET? Threshold: min(2, #judges), and
  // at least one judge must exist for a milestone to ever be considered met.
  let judges: string[] = [];
  try {
    judges = JSON.parse(award.judges || "[]");
  } catch {
    judges = [];
  }
  const judgeSet = new Set(judges.map((j) => j.trim()));
  const attestations = await db.milestoneAttestation.findMany({
    where: { milestoneId: active.id },
  });
  const metVotes = new Set(
    attestations
      .filter((a) => a.vote === "MET" && judgeSet.has(a.judge.trim()))
      .map((a) => a.judge.trim())
  );
  const threshold = Math.min(2, judges.length);
  const met = judges.length > 0 && metVotes.size >= threshold;

  // Remaining pool currently held (locked) by the custodian: every tranche whose
  // index is >= the active pointer. Earlier tranches have already been paid out
  // (MET) or the program would have expired.
  const remainingMicro = sumMicro(
    milestones.filter((m) => m.index >= idx).map((m) => m.amount)
  );
  const isLast = idx >= milestones.length - 1;

  try {
    if (met) {
      // --- MET path: withdraw remaining -> pay this tranche -> re-lock leftover ---

      // Step 1: free the remaining balance from FlowVault (once).
      if (!active.withdrawTxid) {
        const w = await withdrawFromProgram(programId, remainingMicro.toString());
        await db.milestone.update({
          where: { id: active.id },
          data: { withdrawTxid: w.txid, withdrawExplorerUrl: w.explorerUrl, status: "ATTESTED_MET" },
        });
        return { programId, action: "withdrew", txid: w.txid, detail: "freed remaining pool for payout" };
      }

      // Gate the next step on the withdraw confirming.
      const wStatus = await getTxStatus(active.withdrawTxid);
      if (wStatus !== "success") {
        return { programId, action: "waiting_confirmation", detail: `withdraw ${wStatus}` };
      }

      // Step 2: pay the earned tranche to the builder (once).
      if (!active.payoutTxid) {
        const p = await transferFromProgram(
          programId,
          award.builderAddress,
          active.amount,
          `Covenant milestone ${idx + 1}: ${active.name}`.slice(0, 34)
        );
        await db.$transaction([
          db.milestone.update({
            where: { id: active.id },
            data: { payoutTxid: p.txid, payoutExplorerUrl: p.explorerUrl, status: "PAID" },
          }),
          db.distribution.create({
            data: {
              awardId: award.id,
              recipient: award.builderAddress,
              amount: active.amount,
              txid: p.txid,
              explorerUrl: p.explorerUrl,
              kind: "MILESTONE_PAYOUT",
            },
          }),
          db.programStateLog.create({
            data: {
              programId,
              status: "AWARDED",
              note: `Milestone ${idx + 1} (${active.name}) paid to builder`,
              txid: p.txid,
              explorerUrl: p.explorerUrl,
            },
          }),
        ]);

        // Last milestone paid -> the whole award and program are complete.
        if (isLast) {
          await db.$transaction([
            db.award.update({ where: { id: award.id }, data: { status: "COMPLETED" } }),
            db.grantProgram.update({ where: { id: programId }, data: { status: "COMPLETED" } }),
            db.programStateLog.create({
              data: { programId, status: "COMPLETED", note: "Final milestone paid — program complete" },
            }),
          ]);
          return { programId, action: "completed", txid: p.txid, detail: "final milestone paid" };
        }
        return { programId, action: "paid_milestone", txid: p.txid, detail: `milestone ${idx + 1} paid` };
      }

      // Gate the re-lock on the payout confirming.
      const pStatus = await getTxStatus(active.payoutTxid);
      if (pStatus !== "success") {
        return { programId, action: "waiting_confirmation", detail: `payout ${pStatus}` };
      }

      // Step 3: re-lock the leftover for the next milestone, and advance pointer.
      if (!active.relockTxid && !isLast) {
        const next = milestones.find((m) => m.index === idx + 1)!;
        const leftoverMicro = remainingMicro - BigInt(active.amount);
        const r = await lockPoolForProgram(programId, leftoverMicro.toString(), next.deadlineBlock);
        await db.$transaction([
          db.milestone.update({
            where: { id: active.id },
            data: { relockTxid: r.txid, relockExplorerUrl: r.explorerUrl },
          }),
          db.milestone.update({
            where: { id: next.id },
            data: { lockUntilBlock: next.deadlineBlock, status: "LOCKED" },
          }),
          db.award.update({ where: { id: award.id }, data: { activeMilestoneIndex: idx + 1 } }),
        ]);
        return { programId, action: "relocked", txid: r.txid, detail: `re-locked leftover until block ${next.deadlineBlock}` };
      }

      return { programId, action: "noop", detail: "milestone fully processed" };
    } else {
      // --- EXPIRED path: withdraw remaining -> return everything to grantor ---

      if (!active.withdrawTxid) {
        const w = await withdrawFromProgram(programId, remainingMicro.toString());
        await db.milestone.update({
          where: { id: active.id },
          data: { withdrawTxid: w.txid, withdrawExplorerUrl: w.explorerUrl, status: "EXPIRED" },
        });
        return { programId, action: "withdrew", txid: w.txid, detail: "milestone expired — freeing pool for grantor return" };
      }

      const wStatus = await getTxStatus(active.withdrawTxid);
      if (wStatus !== "success") {
        return { programId, action: "waiting_confirmation", detail: `withdraw ${wStatus}` };
      }

      const alreadyReturned = award.distributions.some((d) => d.kind === "GRANTOR_RETURN");
      if (!alreadyReturned) {
        const ret = await transferFromProgram(
          programId,
          program.grantorAddress,
          remainingMicro.toString(),
          `Covenant grant return`.slice(0, 34)
        );
        await db.$transaction([
          db.distribution.create({
            data: {
              awardId: award.id,
              recipient: program.grantorAddress,
              amount: remainingMicro.toString(),
              txid: ret.txid,
              explorerUrl: ret.explorerUrl,
              kind: "GRANTOR_RETURN",
            },
          }),
          // Mark this and every remaining milestone EXPIRED.
          ...milestones
            .filter((m) => m.index >= idx && m.status !== "PAID")
            .map((m) =>
              db.milestone.update({ where: { id: m.id }, data: { status: "EXPIRED" } })
            ),
          db.award.update({ where: { id: award.id }, data: { status: "FAILED" } }),
          db.grantProgram.update({ where: { id: programId }, data: { status: "EXPIRED" } }),
          db.programStateLog.create({
            data: {
              programId,
              status: "EXPIRED",
              note: `Milestone ${idx + 1} deadline passed without attestation — remaining pool returned to grantor`,
              txid: ret.txid,
              explorerUrl: ret.explorerUrl,
            },
          }),
        ]);
        return { programId, action: "expired", txid: ret.txid, detail: "remaining pool returned to grantor" };
      }

      return { programId, action: "noop", detail: "expiry already settled" };
    }
  } catch (err: any) {
    console.error(`[reconcile ${programId}]`, err);
    return { programId, action: "error", detail: err?.message || String(err) };
  }
}

/**
 * Reconcile every program that could still need an on-chain step (AWARDED).
 * Sequential to keep nonce usage across shared/master gas predictable; each
 * program's own custodian nonce is independent, but sequential runs are simplest
 * and reconcile is one tx per program per call anyway.
 */
export async function reconcileAllActive(): Promise<ReconcileResult[]> {
  const db = getDb();
  const active = await db.grantProgram.findMany({
    where: { status: "AWARDED" },
    select: { id: true },
  });
  const results: ReconcileResult[] = [];
  for (const p of active) {
    results.push(await reconcileProgram(p.id));
  }
  return results;
}
