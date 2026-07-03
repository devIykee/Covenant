"use client";

import Link from "next/link";

export type Role = "grantor" | "builder" | "judge";

export interface NextStepInput {
  role: Role;
  id: string;
  status: string;               // program status: DRAFT | FUNDED_OPEN | AWARDED | COMPLETED | EXPIRED
  applicationStatus?: string | null; // for builders: PENDING | ACCEPTED | REJECTED
  activeMilestone?: { index: number; name: string; status: string } | null;
  linkToDetail?: boolean;
}

// The phases a grant program moves through. Derived from the same `status` the
// detail page's action panel gates on, so stepper and actions never disagree.
const PHASES = ["Fund", "Open", "Building", "Done"];

function phaseOf(status: string): number {
  if (status === "FUNDED_OPEN") return 1;
  if (status === "AWARDED") return 2;
  if (status === "COMPLETED" || status === "EXPIRED") return 3;
  return 0; // DRAFT
}

function guidance(p: NextStepInput): { title: string; detail: string } {
  const phase = phaseOf(p.status);
  const ms = p.activeMilestone;

  if (p.role === "grantor") {
    if (phase === 0) return { title: "Fund the escrow", detail: "Send the full pool to this program's custodian, then publish it so builders can apply." };
    if (phase === 1) return { title: "Review applications", detail: "Builders are applying. Accept one and define their milestone schedule to award the grant." };
    if (phase === 2) return { title: "Grant in progress", detail: `Milestones disburse automatically at each deadline. ${ms ? `Active: M${ms.index + 1} (${ms.name}).` : ""} Nothing to click — the schedule runs itself.` };
    return p.status === "COMPLETED"
      ? { title: "Program complete", detail: "Every milestone was attested and paid. The full pool went to the builder." }
      : { title: "Program expired", detail: "A milestone lapsed un-attested. The remaining pool was returned to your wallet." };
  }

  if (p.role === "builder") {
    if (phase <= 1) {
      if (p.applicationStatus === "ACCEPTED") return { title: "You were awarded", detail: "Open the program to start on milestone 1." };
      if (p.applicationStatus === "REJECTED") return { title: "Not selected", detail: "The grantor awarded another builder for this program." };
      if (p.applicationStatus === "PENDING") return { title: "Application pending", detail: "The grantor is reviewing applications. If awarded, you'll get a milestone schedule." };
      return { title: "Apply to build", detail: "Open the program and submit a pitch to be considered for the award." };
    }
    if (phase === 2) {
      if (!ms) return { title: "Grant in progress", detail: "Your award is active." };
      if (ms.status === "LOCKED") return { title: `Build M${ms.index + 1}: ${ms.name}`, detail: "When it's done, mark the milestone ready so judges can attest it." };
      return { title: `M${ms.index + 1} in review`, detail: "Judges are attesting. The tranche auto-pays you at the deadline if they attest MET." };
    }
    return p.status === "COMPLETED"
      ? { title: "All milestones paid", detail: "You completed the grant — every tranche was disbursed to your wallet." }
      : { title: "Grant expired", detail: "A milestone deadline passed without attestation; remaining funds returned to the grantor." };
  }

  // judge
  if (phase === 2 && ms) {
    if (ms.status === "PAID" || ms.status === "EXPIRED") return { title: "Milestone settled", detail: "Waiting for the next milestone to become active." };
    return { title: `Attest M${ms.index + 1}: ${ms.name}`, detail: "Open the program and sign MET or NOT MET. Your vote gates the automatic payout at the deadline." };
  }
  if (phase === 3) return { title: "Program finished", detail: "No further attestations needed." };
  return { title: "Awaiting award", detail: "Once the grantor awards a builder, you'll attest their milestones." };
}

export function NextStep(props: NextStepInput) {
  const phase = phaseOf(props.status);
  const g = guidance(props);

  return (
    <div className="border border-[var(--ink)]/15 rounded-sm p-5 bg-[var(--surface-container-low)]">
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

      <div className="border-t border-[var(--ink)]/10 pt-3">
        <div className="font-label-caps text-[10px] text-[var(--brass)] mb-0.5">YOU ARE HERE · {props.role.toUpperCase()}</div>
        <div className="font-semibold text-sm text-[var(--ink)]">{g.title}</div>
        <p className="text-xs text-[var(--on-surface-variant)] mt-1">{g.detail}</p>
        {props.linkToDetail && (
          <Link href={`/projects/${props.id}`} className="btn-secondary text-[11px] px-3 py-1.5 mt-3 inline-block">OPEN PROGRAM →</Link>
        )}
      </div>
    </div>
  );
}
