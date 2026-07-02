"use client";

import { Nav } from "@/src/components/Nav";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

interface Investor { principal: string; amount: string; depositExplorerUrl: string | null }
interface DashProject {
  id: string;
  title: string;
  status: string;
  fundingGoal: string;
  minFundingBps: number;
  builderAcceptedPartial: boolean;
  raised: string;
  minRequired: string;
  metMin: boolean;
  judgeCount: number;
  investors: Investor[];
  myContribution?: string;
  myWithdrawn?: boolean;
}

const usd = (m: string) => (Number(m) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });
const preLock = (s: string) => s === "CREATED" || s === "BACKING_OPEN";

function badge(status: string) {
  const map: Record<string, string> = {
    RESOLVED_SUCCESS: "bg-[var(--brass)]/20 text-[var(--brass)]",
    RESOLVED_FAILURE: "bg-[var(--signet)]/20 text-[var(--signet)]",
    POOLED_LOCKED: "bg-[var(--ink)]/15 text-[var(--ink)]",
    DISPUTE_WINDOW: "bg-[var(--ink)]/15 text-[var(--ink)]",
  };
  return <span className={`text-[10px] font-label-caps px-2 py-0.5 rounded ${map[status] || "bg-[var(--ink)]/10 text-[var(--ink)]"}`}>{status.replace("_", " ")}</span>;
}

function nextStep(p: DashProject): string {
  if (p.status === "RESOLVED_SUCCESS") return "Complete — funds released.";
  if (p.status === "RESOLVED_FAILURE") return "Closed — investors refunded.";
  if (p.status === "POOLED_LOCKED") return "Funds locked in escrow; awaiting judge attestation.";
  if (p.status === "DISPUTE_WINDOW") return "Judges attested MET — in the dispute window before release.";
  if (p.investors.length === 0) return "Waiting for investors to deposit.";
  if (p.judgeCount === 0) return "Investors need to appoint judges before funds can lock.";
  if (!p.metMin) return "Below your minimum — accept the partial raise to proceed, or wait for more.";
  return "Ready to lock funds in escrow.";
}

export default function Dashboard() {
  const [addr, setAddr] = useState<string | null>(null);
  const [data, setData] = useState<{ asBuilder: DashProject[]; asInvestor: DashProject[] }>({ asBuilder: [], asInvestor: [] });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (a: string) => {
    try {
      const res = await fetch(`/api/dashboard?address=${encodeURIComponent(a)}`);
      setData(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const a = typeof window !== "undefined" ? localStorage.getItem("covenant-address") : null;
    setAddr(a);
    if (a) load(a);
  }, [load]);

  async function acceptPartial(id: string) {
    if (!addr) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/projects/${id}/accept-partial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ builder: addr }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast.success("Accepted the partial raise — you can now lock funds.");
      await load(addr);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function withdraw(id: string) {
    if (!addr) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/projects/${id}/withdraw-contribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investor: addr }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast.success("Deposit refunded to your wallet.");
      if (d.explorerUrl) window.open(d.explorerUrl, "_blank");
      await load(addr);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  function ProgressRow({ p }: { p: DashProject }) {
    const pct = Math.min(100, Math.round((Number(p.raised) / Number(p.fundingGoal)) * 100));
    const minPct = Math.min(100, Math.round(p.minFundingBps / 100));
    return (
      <div>
        <div className="flex justify-between text-xs font-label-caps text-[var(--on-surface-variant)] mb-1">
          <span>RAISED</span>
          <span>{usd(p.raised)} / {usd(p.fundingGoal)} USDCx · min {minPct}%</span>
        </div>
        <div className="relative progress-bar w-full">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
          <div className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-[var(--signet)]" style={{ left: `${minPct}%` }} title={`Minimum ${minPct}%`} />
        </div>
      </div>
    );
  }

  if (!addr) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-grow max-w-[1000px] mx-auto w-full px-6 py-24 text-center">
          <h1 className="font-display-lg text-3xl mb-3">Your Dashboard</h1>
          <p className="text-[var(--on-surface-variant)]">Connect your wallet (top-right) to see the campaigns you&rsquo;ve created and the ones you&rsquo;ve invested in.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-grow max-w-[1000px] mx-auto w-full px-6 py-12">
        <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">DASHBOARD</div>
        <h1 className="font-display-lg text-3xl mb-1">Your covenants</h1>
        <p className="text-sm text-[var(--on-surface-variant)] mb-10 font-data-sm">{addr.slice(0, 10)}…{addr.slice(-4)}</p>

        {/* As builder */}
        <section className="mb-12">
          <h2 className="font-headline-md text-xl mb-1">Campaigns you created</h2>
          <p className="text-sm text-[var(--on-surface-variant)] mb-5">Track funding, see who invested, and manage settlement.</p>
          {data.asBuilder.length === 0 ? (
            <div className="border border-dashed border-[var(--ink)]/20 rounded-sm p-8 text-center text-sm text-[var(--on-surface-variant)]">
              You haven&rsquo;t created any campaigns. <Link href="/projects/create" className="underline text-[var(--ink)]">Create one</Link>.
            </div>
          ) : (
            <div className="space-y-5">
              {data.asBuilder.map((p) => (
                <div key={p.id} className="card-container p-6">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <Link href={`/projects/${p.id}`} className="font-semibold hover:underline">{p.title}</Link>
                    {badge(p.status)}
                  </div>
                  <ProgressRow p={p} />
                  <p className="text-xs text-[var(--on-surface-variant)] mt-3"><strong className="text-[var(--ink)]">Next:</strong> {nextStep(p)}</p>

                  <div className="mt-4 border-t border-[var(--ink)]/10 pt-3">
                    <div className="font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-2">INVESTORS ({p.investors.length})</div>
                    {p.investors.length === 0 ? (
                      <div className="text-xs text-[var(--on-surface-variant)]">No deposits yet.</div>
                    ) : (
                      <div className="space-y-1">
                        {p.investors.map((inv, i) => (
                          <div key={i} className="flex justify-between text-xs font-data-sm">
                            <span>{inv.principal.slice(0, 12)}…{inv.principal.slice(-4)}</span>
                            <span className="flex items-center gap-2">
                              {usd(inv.amount)} USDCx
                              {inv.depositExplorerUrl && <a href={inv.depositExplorerUrl} target="_blank" rel="noreferrer" className="underline text-[var(--on-surface-variant)] hover:text-[var(--ink)]">↗</a>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {preLock(p.status) && !p.metMin && p.investors.length > 0 && (
                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap border border-[var(--signet)]/30 bg-[var(--signet)]/5 rounded-sm p-3">
                      <span className="text-xs text-[var(--on-surface-variant)]">Under your minimum. You can proceed with what&rsquo;s raised, or wait for more.</span>
                      <button onClick={() => acceptPartial(p.id)} disabled={busy === p.id} className="btn-primary text-[11px] px-3 py-1.5 disabled:opacity-50">
                        {busy === p.id ? "…" : "ACCEPT PARTIAL & PROCEED"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* As investor */}
        <section>
          <h2 className="font-headline-md text-xl mb-1">Campaigns you invested in</h2>
          <p className="text-sm text-[var(--on-surface-variant)] mb-5">Your deposits and what&rsquo;s happening with each.</p>
          {data.asInvestor.length === 0 ? (
            <div className="border border-dashed border-[var(--ink)]/20 rounded-sm p-8 text-center text-sm text-[var(--on-surface-variant)]">
              You haven&rsquo;t invested yet. <Link href="/projects" className="underline text-[var(--ink)]">Browse campaigns</Link>.
            </div>
          ) : (
            <div className="space-y-5">
              {data.asInvestor.map((p) => (
                <div key={p.id} className="card-container p-6">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <Link href={`/projects/${p.id}`} className="font-semibold hover:underline">{p.title}</Link>
                    {badge(p.status)}
                  </div>
                  <ProgressRow p={p} />
                  <div className="flex justify-between items-center mt-3">
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      <strong className="text-[var(--ink)]">Your deposit:</strong> {usd(p.myContribution || "0")} USDCx {p.myWithdrawn && <span className="text-[var(--signet)]">(withdrawn)</span>}
                    </p>
                    {preLock(p.status) && Number(p.myContribution) > 0 && (
                      <button onClick={() => withdraw(p.id)} disabled={busy === p.id} className="btn-secondary text-[11px] px-3 py-1.5 disabled:opacity-50">
                        {busy === p.id ? "…" : "WITHDRAW MY DEPOSIT"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[var(--on-surface-variant)] mt-2"><strong className="text-[var(--ink)]">Status:</strong> {nextStep(p)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
