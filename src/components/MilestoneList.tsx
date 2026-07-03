"use client";

import { formatUsdcx } from "@/src/lib/units";
import { formatDeadline, relativeTime } from "@/src/lib/format";

export interface MilestoneView {
  index: number;
  name: string;
  description?: string;
  percentBps: number;
  amount: string;
  deadlineBlock: number;
  deadlineAt?: string | null;
  status: string; // LOCKED | READY_FOR_REVIEW | ATTESTED_MET | PAID | EXPIRED
  payoutExplorerUrl?: string | null;
  attestations?: { judge: string; vote: string }[];
}

const STATE_META: Record<string, { label: string; cls: string }> = {
  LOCKED: { label: "LOCKED", cls: "stamp-locked" },
  READY_FOR_REVIEW: { label: "IN REVIEW", cls: "stamp-open border-2" },
  ATTESTED_MET: { label: "ATTESTED · AWAITING DEADLINE", cls: "stamp-open border-2" },
  PAID: { label: "PAID", cls: "stamp-resolved" },
  EXPIRED: { label: "EXPIRED", cls: "stamp-refunded" },
};

// Structured, always-visible milestone checklist — never a bare status string.
// Shows every milestone's name, deadline (real date), share, payment, and current
// state, and marks which one is active (the only one that can be attested next).
export function MilestoneList({
  milestones,
  activeIndex,
  currentBlock,
  judgeCount,
}: {
  milestones: MilestoneView[];
  activeIndex: number;
  currentBlock: number;
  judgeCount?: number;
}) {
  const threshold = judgeCount ? Math.min(2, judgeCount) : 2;

  return (
    <ol className="space-y-3">
      {milestones.map((m) => {
        const meta = STATE_META[m.status] ?? { label: m.status, cls: "stamp-locked" };
        const isActive = m.index === activeIndex && m.status !== "PAID" && m.status !== "EXPIRED";
        const metVotes = (m.attestations || []).filter((a) => a.vote === "MET").length;
        const past = m.deadlineAt ? new Date(m.deadlineAt).getTime() <= Date.now() : m.deadlineBlock - currentBlock <= 0;
        return (
          <li
            key={m.index}
            className={`border rounded-sm p-4 ${isActive ? "border-[var(--brass)] bg-[var(--brass)]/5" : "border-[var(--ink)]/10"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-data-sm text-xs text-[var(--on-surface-variant)]">M{m.index + 1}</span>
                  <span className="font-headline-md text-base truncate">{m.name}</span>
                  {isActive && <span className="font-label-caps text-[9px] text-[var(--brass)]">ACTIVE</span>}
                </div>
                {m.description ? <p className="text-sm text-[var(--on-surface-variant)] mb-2">{m.description}</p> : null}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--on-surface-variant)]">
                  <span>SHARE <span className="font-data-sm text-[var(--ink)]">{(m.percentBps / 100).toFixed(m.percentBps % 100 ? 2 : 0)}%</span></span>
                  <span>PAYMENT <span className="font-data-sm text-[var(--ink)]">{formatUsdcx(m.amount)} USDCx</span></span>
                  <span>DEADLINE <span className="font-data-sm text-[var(--ink)]">{formatDeadline(m.deadlineAt, m.deadlineBlock)}</span></span>
                  {m.status !== "PAID" && m.status !== "EXPIRED" ? (
                    <span className={past ? "text-[var(--brass)]" : ""}>
                      {past ? "deadline reached" : (m.deadlineAt ? relativeTime(m.deadlineAt) : "")}
                    </span>
                  ) : null}
                  {(m.attestations && m.attestations.length > 0 && m.status !== "PAID") ? (
                    <span>ATTESTED <span className="font-data-sm text-[var(--ink)]">{metVotes}/{threshold} MET</span></span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className={`${meta.cls} px-2 py-0.5 text-[10px] font-bold rounded-sm inline-block`}>{meta.label}</span>
                {m.status === "PAID" && m.payoutExplorerUrl ? (
                  <a href={m.payoutExplorerUrl} target="_blank" rel="noreferrer" className="block mt-1 text-[11px] underline text-[var(--on-surface-variant)]">view payout ↗</a>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
