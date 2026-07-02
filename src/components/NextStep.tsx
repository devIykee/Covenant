"use client";

import Link from "next/link";
import { formatUsdcx } from "@/src/lib/units";

export type Role = "backer" | "builder";

export interface NextStepInput {
  role: Role;
  id: string;
  status: string;
  raisedMicro: string | number;
  goalMicro: string | number;
  minBps: number;
  metMin: boolean;
  judgeCount: number;
  metCount?: number;
  threshold?: number;
  myContributionMicro?: string | number;
  myWithdrawn?: boolean;
  linkToDetail?: boolean; // show a "Open campaign" link (used on the dashboard)
}

// The four on-chain phases every campaign moves through. Derived from the same
// `status` the settlement buttons gate on, so the stepper and buttons never disagree.
const PHASES = ["Funding", "Locked", "Judging", "Resolved"];

function phaseOf(status: string): number {
  if (status === "POOLED_LOCKED") return 1;
  if (status === "DISPUTE_WINDOW") return 2;
  if (status === "RESOLVED_SUCCESS" || status === "RESOLVED_FAILURE") return 3;
  return 0; // CREATED / BACKING_OPEN / anything else
}

function guidance(p: NextStepInput): { title: string; detail: string } {
  const phase = phaseOf(p.status);
  const resolvedOk = p.status === "RESOLVED_SUCCESS";
  const mine = Number(p.myContributionMicro || 0);
  const minPct = Math.round(p.minBps / 100);

  if (p.role === "backer") {
    if (phase === 0) {
      if (mine <= 0 || p.myWithdrawn) return { title: "Fund this grant", detail: "Enter an amount and confirm. Your USDCx goes into escrow, not to the builder — it's only disbursed if the milestone is met." };
      if (!p.metMin) return { title: "Funding is below the minimum", detail: `Only ${minPct}%+ of the goal unlocks this grant. You can withdraw your contribution now, or wait — funds stay parked in escrow until the builder decides.` };
      return { title: "You're in — appoint judges", detail: "Minimum reached. As a backer you can appoint the judges who'll verify the milestone (you can appoint yourself), then the builder locks the funds." };
    }
    if (phase === 1) return { title: "Funds locked in escrow", detail: "Your contribution is locked on-chain in FlowVault until the deadline. Judges will attest whether the milestone was met." };
    if (phase === 2) return { title: "Judges are attesting", detail: `${p.metCount ?? 0} of ${p.threshold ?? 2} needed have signed MET. If they reach the threshold the grant is disbursed; if the deadline passes without consensus, you're refunded.` };
    return resolvedOk
      ? { title: "Milestone met — grant disbursed", detail: "The covenant resolved successfully. The grant went to the builder; your pro-rata 20% share was returned to your wallet." }
      : { title: "Not met — refunded", detail: "The milestone wasn't met (or the deadline passed without consensus). Your contribution was refunded in full." };
  }

  // builder
  if (phase === 0) {
    if (Number(p.raisedMicro) <= 0) return { title: "Waiting for backers", detail: "Your campaign is live. Share it — backers fund the grant into escrow, then appoint the judges." };
    if (!p.metMin) return { title: "Below your minimum", detail: `You set a ${minPct}% minimum. Wait for more backers, or accept the partial raise to proceed with what's in escrow.` };
    if (p.judgeCount === 0) return { title: "Waiting on judges", detail: "You've hit your minimum. Backers need to appoint at least one judge before you can lock the funds." };
    return { title: "Ready to lock funds", detail: "Minimum reached and judges appointed. Lock the raised USDCx in escrow to start the milestone period." };
  }
  if (phase === 1) return { title: "Funds locked", detail: "The grant is locked in FlowVault until the deadline. Waiting for judges to attest the milestone." };
  if (phase === 2) return { title: "Judges attesting", detail: `${p.metCount ?? 0} of ${p.threshold ?? 2} needed have signed MET. Once the threshold is met, disburse the grant (80% to you, 20% returned to backers). If the deadline passes without consensus, backers are refunded.` };
  return resolvedOk
    ? { title: "Grant disbursed — milestone met", detail: "Resolved successfully. 80% went to your treasury, 20% pro-rata to backers." }
    : { title: "Refunded — not met", detail: "The milestone wasn't met (or timed out). 100% of the pool was refunded to backers." };
}

export function NextStep(props: NextStepInput) {
  const phase = phaseOf(props.status);
  const g = guidance(props);

  return (
    <div className="border border-[var(--ink)]/15 rounded-sm p-5 bg-[var(--surface-container-low)]">
      {/* Stepper */}
      <div className="flex items-center mb-4">
        {PHASES.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                i < phase ? "bg-[var(--ink)] text-[var(--parchment)] border-[var(--ink)]"
                : i === phase ? "border-[var(--brass)] text-[var(--brass)]"
                : "border-[var(--ink)]/25 text-[var(--on-surface-variant)]"
              }`}>{i < phase ? "✓" : i + 1}</div>
              <span className={`mt-1 text-[9px] font-label-caps ${i === phase ? "text-[var(--brass)]" : "text-[var(--on-surface-variant)]"}`}>{label}</span>
            </div>
            {i < PHASES.length - 1 && <div className={`h-[2px] flex-1 mx-1 ${i < phase ? "bg-[var(--ink)]" : "bg-[var(--ink)]/20"}`} />}
          </div>
        ))}
      </div>

      {/* Current action */}
      <div className="border-t border-[var(--ink)]/10 pt-3">
        <div className="font-label-caps text-[10px] text-[var(--brass)] mb-0.5">YOU ARE HERE · {props.role.toUpperCase()}</div>
        <div className="font-semibold text-sm text-[var(--ink)]">{g.title}</div>
        <p className="text-xs text-[var(--on-surface-variant)] mt-1">{g.detail}</p>
        {props.linkToDetail && (
          <Link href={`/projects/${props.id}`} className="btn-secondary text-[11px] px-3 py-1.5 mt-3 inline-block">OPEN CAMPAIGN →</Link>
        )}
      </div>
    </div>
  );
}
