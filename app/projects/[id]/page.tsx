"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Nav } from "@/src/components/Nav";
import { toast } from "sonner";
import { request } from "@stacks/connect";
import { MilestoneList } from "@/src/components/MilestoneList";
import { GuidedTour, type TourStep } from "@/src/components/GuidedTour";
import { transferUsdcxTo } from "@/src/lib/deposit";
import { getCurrentBlockHeight } from "@/src/lib/flowvault";
import { formatUsdcx } from "@/src/lib/units";
import { eqAddr, includesAddr } from "@/src/lib/address";

const DETAIL_TOUR: TourStep[] = [
  { selector: "#tour-state", title: "Current state", body: "This program's live status. The one action available to you (given your role and the state) appears right below it — nothing else." },
  { selector: "#tour-milestones", title: "Milestone checklist", body: "Once awarded, each tranche shows its deadline, share, and state. The active milestone is highlighted; its tranche auto-pays the builder when judges attest it MET before the deadline." },
];

const BLOCKS_PER_HOUR = 144;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    COMPLETED: "stamp-resolved", EXPIRED: "stamp-refunded", AWARDED: "stamp-locked",
    FUNDED_OPEN: "stamp-open border-2", DRAFT: "stamp-open border-2 opacity-60",
  };
  return <span className={`${map[status] || "stamp-open"} px-3 py-1 text-[11px] font-bold rounded-sm`}>{status.replace("_", " ")}</span>;
}

interface MilestoneRow { name: string; percent: string; deadlineDate: string }

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const [program, setProgram] = useState<any>(null);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [connectedAddr, setConnectedAddr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [custodian, setCustodian] = useState<{ address: string; balance: string; funded: boolean } | null>(null);

  // builder application form
  const [pitch, setPitch] = useState("");
  const [contact, setContact] = useState("");

  // grantor award form
  const [awardOpenFor, setAwardOpenFor] = useState<string | null>(null);
  const [judgesText, setJudgesText] = useState("");
  const [rows, setRows] = useState<MilestoneRow[]>([{ name: "", percent: "", deadlineDate: "" }]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${id}`, { cache: "no-store" });
    if (!res.ok) { toast.error("Program not found"); return; }
    const data = await res.json();
    setProgram(data);
    if (data.currentBlock) setCurrentBlock(data.currentBlock);
  }, [id]);

  useEffect(() => {
    if (typeof window !== "undefined") setConnectedAddr(localStorage.getItem("covenant-address"));
    load();
  }, [load]);

  const isGrantor = program && eqAddr(connectedAddr, program.grantorAddress);

  // Poll custodian balance while a DRAFT program is being funded by its grantor.
  useEffect(() => {
    if (!program || program.status !== "DRAFT" || !isGrantor) return;
    let stop = false;
    const poll = async () => {
      const r = await fetch(`/api/programs/${id}/custodian`, { cache: "no-store" });
      if (r.ok && !stop) setCustodian(await r.json());
    };
    poll();
    const t = setInterval(poll, 12000);
    return () => { stop = true; clearInterval(t); };
  }, [program, isGrantor, id]);

  if (!program) {
    return <div className="min-h-screen flex flex-col"><Nav /><main className="flex-grow max-w-3xl mx-auto w-full px-6 py-24 text-center text-[var(--on-surface-variant)]">Loading program…</main></div>;
  }

  const award = program.award;
  const myApplication = (program.applications || []).find((a: any) => eqAddr(a.builderAddress, connectedAddr));
  const isAwardedBuilder = award && eqAddr(award.builderAddress, connectedAddr);
  let judges: string[] = [];
  try { judges = JSON.parse(award?.judges || "[]"); } catch { judges = []; }
  const isJudge = includesAddr(judges, connectedAddr);
  const activeMs = award?.milestones?.find((m: any) => m.index === award.activeMilestoneIndex);

  // ---- actions ----
  async function fundEscrow() {
    setBusy(true);
    try {
      const address = custodian?.address || program.custodianAddress;
      const { explorerUrl } = await transferUsdcxTo(address, program.totalPool);
      toast.success("Pool sent to escrow. Waiting for on-chain confirmation…");
      window.open(explorerUrl, "_blank");
    } catch (e: any) { toast.error(e.message || "Transfer failed"); }
    finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true);
    try {
      const res = await fetch(`/api/programs/${id}/fund`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantorAddress: connectedAddr, fundTxid: program.fundTxid || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Funding not verified yet");
      toast.success("Escrow verified — program published.");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function apply() {
    if (!connectedAddr) return toast.error("Connect your wallet to apply.");
    if (!pitch.trim()) return toast.error("Write a short pitch.");
    setBusy(true);
    try {
      const res = await fetch(`/api/programs/${id}/apply`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ builderAddress: connectedAddr, pitch, contact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Application submitted.");
      setPitch(""); setContact(""); await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function submitAward(applicationId: string) {
    setBusy(true);
    try {
      const judgeList = judgesText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      if (judgeList.length === 0) throw new Error("Add at least one judge address.");
      const current = await getCurrentBlockHeight();
      const milestones = rows.map((r) => {
        if (!r.name || !r.percent || !r.deadlineDate) throw new Error("Every milestone needs a name, %, and deadline.");
        const hours = Math.max(1, (new Date(r.deadlineDate).getTime() - Date.now()) / 3.6e6);
        return {
          name: r.name,
          percentBps: Math.round(Number(r.percent) * 100),
          deadlineBlock: Math.floor(current + hours * BLOCKS_PER_HOUR),
          deadlineAt: new Date(r.deadlineDate).toISOString(),
        };
      });
      const res = await fetch(`/api/programs/${id}/accept`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantorAddress: connectedAddr, applicationId, judges: judgeList, milestones }),
      });
      const data = await res.json();
      if (!res.ok && !data.ok) throw new Error(data.error);
      toast.success(data.partial ? "Awarded — finalizing on-chain lock…" : "Awarded and pool locked. Milestones are live.");
      setAwardOpenFor(null); await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function markReady() {
    setBusy(true);
    try {
      const res = await fetch(`/api/programs/${id}/milestones/${award.activeMilestoneIndex}/ready`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ builderAddress: connectedAddr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Marked ready for review.");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function attest(vote: "MET" | "NOT_MET") {
    setBusy(true);
    try {
      const idx = award.activeMilestoneIndex;
      const message = `Covenant ${id} milestone ${idx}: ${vote}`;
      const signed: any = await request("stx_signMessage", { message });
      const signature = signed?.signature || signed?.result?.signature;
      const publicKey = signed?.publicKey || signed?.result?.publicKey;
      if (!signature || !publicKey) throw new Error("Wallet did not return a signature.");
      const res = await fetch(`/api/programs/${id}/milestones/${idx}/attest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judge: connectedAddr, vote, signature, publicKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Attested ${vote}. (${data.metCount}/${data.threshold} MET) — payout auto-releases at the deadline.`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function sync() {
    setBusy(true);
    try {
      await fetch(`/api/programs/${id}/sync`, { method: "POST" });
      await load();
      toast.success("Refreshed on-chain state.");
    } catch { /* ignore */ }
    finally { setBusy(false); }
  }

  // ---- the single available action for the current viewer + state ----
  function ActionPanel() {
    // DRAFT: only the grantor (program isn't publicly listed).
    if (program.status === "DRAFT") {
      if (!isGrantor) return <Info>This program hasn&rsquo;t been funded yet and isn&rsquo;t public.</Info>;
      const funded = custodian?.funded;
      return (
        <div className="space-y-3">
          <p className="text-sm text-[var(--on-surface-variant)]">
            Send the full pool of <strong className="text-[var(--ink)]">{formatUsdcx(program.totalPool)} USDCx</strong> to this program&rsquo;s escrow custodian, then publish.
          </p>
          <div className="font-data-sm text-xs break-all bg-[var(--surface-container-low)] border border-[var(--ink)]/10 rounded-sm p-3">
            {custodian?.address || program.custodianAddress}
            <div className="mt-1 text-[var(--on-surface-variant)]">In escrow: {formatUsdcx(custodian?.balance || "0")} / {formatUsdcx(program.totalPool)} USDCx {funded ? "✓" : ""}</div>
          </div>
          {!funded ? (
            <button disabled={busy} onClick={fundEscrow} className="btn-primary w-full disabled:opacity-50">{busy ? "SENDING…" : "SEND POOL TO ESCROW"}</button>
          ) : (
            <button disabled={busy} onClick={publish} className="btn-primary w-full disabled:opacity-50">{busy ? "PUBLISHING…" : "PUBLISH PROGRAM"}</button>
          )}
        </div>
      );
    }

    // FUNDED_OPEN: grantor reviews applications & awards; builders apply.
    if (program.status === "FUNDED_OPEN") {
      if (isGrantor) {
        const apps = program.applications || [];
        if (apps.length === 0) return <Info>Program is live. Waiting for builders to apply.</Info>;
        return (
          <div className="space-y-4">
            <p className="text-sm text-[var(--on-surface-variant)]">Accept one builder and define their milestone schedule.</p>
            {apps.map((a: any) => (
              <div key={a.id} className="border border-[var(--ink)]/10 rounded-sm p-4">
                <div className="font-data-sm text-xs text-[var(--on-surface-variant)] break-all mb-1">{a.builderAddress}</div>
                <p className="text-sm mb-2">{a.pitch}</p>
                {a.contact ? <p className="text-xs text-[var(--on-surface-variant)] mb-2">Contact: {a.contact}</p> : null}
                {awardOpenFor === a.id ? (
                  <AwardForm onCancel={() => setAwardOpenFor(null)} onSubmit={() => submitAward(a.id)} />
                ) : (
                  <button disabled={busy} onClick={() => setAwardOpenFor(a.id)} className="btn-secondary text-xs">AWARD TO THIS BUILDER →</button>
                )}
              </div>
            ))}
          </div>
        );
      }
      if (myApplication) return <Info>Your application is <strong className="text-[var(--ink)]">{myApplication.status}</strong>. The grantor will award one builder.</Info>;
      return (
        <div className="space-y-3">
          <p className="text-sm text-[var(--on-surface-variant)]">Apply to build this grant. If awarded, you&rsquo;ll deliver against a milestone schedule.</p>
          <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} className="input-line w-full px-4 py-3 text-sm resize-y min-h-[80px]" placeholder="Your pitch: what you'll build, your track record…" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} className="input-line w-full px-4 py-2 text-sm" placeholder="Contact (optional): email / Discord / X" />
          <button disabled={busy} onClick={apply} className="btn-primary w-full disabled:opacity-50">{busy ? "SUBMITTING…" : "APPLY TO BUILD"}</button>
        </div>
      );
    }

    // AWARDED: milestone machine drives payouts automatically.
    if (program.status === "AWARDED") {
      if (isAwardedBuilder && activeMs) {
        if (activeMs.status === "LOCKED") {
          return <div className="space-y-2"><p className="text-sm text-[var(--on-surface-variant)]">You&rsquo;re building milestone <strong className="text-[var(--ink)]">M{activeMs.index + 1}: {activeMs.name}</strong>. When it&rsquo;s done, tell the judges.</p>
            <button disabled={busy} onClick={markReady} className="btn-primary w-full disabled:opacity-50">{busy ? "…" : "MARK MILESTONE READY FOR REVIEW"}</button></div>;
        }
        return <Info>Milestone <strong className="text-[var(--ink)]">M{activeMs.index + 1}</strong> is in review. Its tranche auto-pays to you when judges attest MET before the deadline.</Info>;
      }
      if (isJudge && activeMs) {
        if (activeMs.status === "PAID" || activeMs.status === "EXPIRED") return <Info>Nothing to attest right now.</Info>;
        return (
          <div className="space-y-2">
            <p className="text-sm text-[var(--on-surface-variant)]">Attest milestone <strong className="text-[var(--ink)]">M{activeMs.index + 1}: {activeMs.name}</strong>. Your wallet signs the vote; the tranche releases automatically at the deadline if MET reaches {Math.min(2, judges.length)}-of-{judges.length}.</p>
            <div className="flex gap-3">
              <button disabled={busy} onClick={() => attest("MET")} className="btn-primary flex-1 disabled:opacity-50">ATTEST MET</button>
              <button disabled={busy} onClick={() => attest("NOT_MET")} className="btn-secondary flex-1 disabled:opacity-50">ATTEST NOT MET</button>
            </div>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <Info>This grant is live. Milestones disburse automatically at each deadline — no manual release.</Info>
          <button disabled={busy} onClick={sync} className="text-xs underline text-[var(--on-surface-variant)]">{busy ? "refreshing…" : "refresh on-chain state"}</button>
        </div>
      );
    }

    if (program.status === "COMPLETED") return <Info>✓ All milestones paid. This program is complete.</Info>;
    if (program.status === "EXPIRED") return <Info>A milestone deadline passed without attestation. Remaining funds were returned to the grantor.</Info>;
    return null;
  }

  function AwardForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: () => void }) {
    const totalPct = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);
    return (
      <div className="mt-3 space-y-3 border-t border-[var(--ink)]/10 pt-3">
        <div>
          <label className="block font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1">JUDGES (one address per line/comma)</label>
          <textarea value={judgesText} onChange={(e) => setJudgesText(e.target.value)} className="input-line w-full px-3 py-2 text-xs font-data-sm resize-y" rows={2} placeholder="ST... , ST..." />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-label-caps text-[10px] text-[var(--on-surface-variant)]">MILESTONES (percentages must sum to 100%)</label>
            <span className={`text-[10px] font-data-sm ${totalPct === 100 ? "text-[var(--brass)]" : "text-[var(--on-surface-variant)]"}`}>{totalPct}%</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input value={r.name} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="input-line col-span-5 px-2 py-1.5 text-xs" placeholder={`Milestone ${i + 1} name`} />
              <input type="number" value={r.percent} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, percent: e.target.value } : x))} className="input-line col-span-2 px-2 py-1.5 text-xs" placeholder="%" />
              <input type="datetime-local" value={r.deadlineDate} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, deadlineDate: e.target.value } : x))} className="input-line col-span-4 px-2 py-1.5 text-xs" />
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="col-span-1 text-[var(--on-surface-variant)] hover:text-red-600" disabled={rows.length === 1}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => setRows([...rows, { name: "", percent: "", deadlineDate: "" }])} className="text-xs underline text-[var(--on-surface-variant)]">+ add milestone</button>
        </div>
        <div className="flex gap-2 pt-1">
          <button disabled={busy} onClick={onSubmit} className="btn-primary text-xs flex-1 disabled:opacity-50">{busy ? "AWARDING…" : "CONFIRM AWARD & LOCK POOL"}</button>
          <button type="button" onClick={onCancel} className="btn-secondary text-xs">CANCEL</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-grow max-w-3xl mx-auto w-full px-6 py-12">
        <div className="mb-2 font-data-sm text-xs text-[var(--on-surface-variant)]">REF: {String(id).slice(0, 8).toUpperCase()}</div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="font-display-lg-mobile md:font-display-lg text-3xl">{program.title}</h1>
          {statusBadge(program.status)}
        </div>
        <p className="text-[var(--on-surface-variant)] mb-6">{program.description}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 text-sm">
          <Stat label="POOL" value={`${formatUsdcx(program.totalPool)} USDCx`} />
          <Stat label="HORIZON" value={`block ${program.programDeadlineBlock}`} />
          <Stat label="APPLICANTS" value={award ? "awarded" : String((program.applications || []).length)} />
          <Stat label="BLOCK" value={currentBlock ? String(currentBlock) : "—"} />
        </div>

        {program.conditions ? (
          <div className="mb-8 border border-[var(--ink)]/10 rounded-sm p-4">
            <div className="font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1">ELIGIBILITY</div>
            <p className="text-sm text-[var(--on-surface-variant)]">{program.conditions}</p>
          </div>
        ) : null}

        {/* Current state + the single available action */}
        <section id="tour-state" className="card-container p-6 mb-8">
          <div className="font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-3">CURRENT STATE — {program.status.replace("_", " ")}</div>
          <ActionPanel />
        </section>

        {/* Milestone checklist */}
        {award ? (
          <section id="tour-milestones" className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-headline-md text-xl">Milestones</h2>
              <span className="font-data-sm text-xs text-[var(--on-surface-variant)] break-all">builder {award.builderAddress.slice(0, 10)}…</span>
            </div>
            <MilestoneList milestones={award.milestones} activeIndex={award.activeMilestoneIndex} currentBlock={currentBlock} judgeCount={judges.length} />
          </section>
        ) : null}

        {/* Distributions ledger */}
        {award?.distributions?.length ? (
          <section className="mb-8">
            <h2 className="font-headline-md text-xl mb-3">On-chain Distributions</h2>
            <div className="space-y-2">
              {award.distributions.map((d: any) => (
                <a key={d.id} href={d.explorerUrl} target="_blank" rel="noreferrer" className="flex justify-between items-center border border-[var(--ink)]/10 rounded-sm p-3 text-sm hover:bg-[var(--surface-container-low)]">
                  <span>{d.kind === "MILESTONE_PAYOUT" ? "Milestone payout → builder" : "Return → grantor"}</span>
                  <span className="font-data-sm">{formatUsdcx(d.amount)} USDCx ↗</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <GuidedTour steps={DETAIL_TOUR} storageKey={`covenant-detail-tour-${id}-v2`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--ink)]/10 rounded-sm p-3">
      <div className="font-label-caps text-[10px] text-[var(--on-surface-variant)]">{label}</div>
      <div className="font-data-sm text-[var(--ink)] mt-0.5 break-all">{value}</div>
    </div>
  );
}

function Info({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--on-surface-variant)]">{children}</p>;
}
