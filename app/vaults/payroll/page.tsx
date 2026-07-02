"use client";

import { Nav } from "@/src/components/Nav";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

interface CheckIn {
  id: string;
  amount: string | null;
  txid: string | null;
  explorerUrl: string | null;
  createdAt: string;
}
interface Payroll {
  id: string;
  payerAddress: string;
  contributorAddress: string;
  totalBudget: string;
  intervalAmount: string;
  releasedAmount: string;
  status: string;
  clawbackExplorerUrl: string | null;
  checkIns: CheckIn[];
}

const usd = (micro: string) => (Number(micro) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function PayrollVaultPage() {
  const [vaults, setVaults] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({ contributorAddress: "", totalBudget: "10", intervalAmount: "2", payerAddress: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/payroll");
      setVaults(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const saved = typeof window !== "undefined" ? localStorage.getItem("covenant-address") : null;
    if (saved) setForm((f) => ({ ...f, payerAddress: saved }));
  }, [load]);

  async function create() {
    setLoading(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      toast.success("Payroll vault created. Contributor check-ins now release real USDCx.");
      setForm((f) => ({ ...f, contributorAddress: "" }));
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkIn(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/payroll/${id}/checkin`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Release failed");
      toast.success(`Released a payment. TX ${String(data.txid).slice(0, 10)}…`);
      if (data.explorerUrl) window.open(data.explorerUrl, "_blank");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function clawback(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/payroll/${id}/clawback`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clawback failed");
      toast.success(data.refundedToPayer ? "Remaining budget clawed back to payer." : "Marked clawed back.");
      if (data.explorerUrl) window.open(data.explorerUrl, "_blank");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-grow max-w-[1000px] mx-auto w-full px-6 py-12">
        <h1 className="font-display-lg text-3xl mb-2">Streaming Payroll + Clawback</h1>
        <p className="text-[var(--on-surface-variant)] max-w-2xl mb-8">
          A budget is streamed to a contributor in intervals. Each <strong className="text-[var(--ink)]">check-in</strong> proves
          activity and releases one interval as a <strong className="text-[var(--ink)]">real on-chain USDCx transfer</strong> from
          the escrow custodian. Miss a check-in and the payer can <strong className="text-[var(--ink)]">claw back</strong> the
          remainder. The custodian must hold enough USDCx to fund the releases.
        </p>

        {/* Create */}
        <div className="card-container p-6 mb-10">
          <div className="font-label-caps text-xs text-[var(--on-surface-variant)] mb-4">CREATE PAYROLL VAULT</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1">CONTRIBUTOR STX ADDRESS</label>
              <input value={form.contributorAddress} onChange={(e) => setForm({ ...form, contributorAddress: e.target.value })} placeholder="ST…" className="input-line w-full py-2 font-data-sm" />
            </div>
            <div>
              <label className="block font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1">TOTAL BUDGET (USDCx)</label>
              <input type="number" value={form.totalBudget} onChange={(e) => setForm({ ...form, totalBudget: e.target.value })} className="input-line w-full py-2 font-data-lg" />
            </div>
            <div>
              <label className="block font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1">PER-CHECK-IN RELEASE (USDCx)</label>
              <input type="number" value={form.intervalAmount} onChange={(e) => setForm({ ...form, intervalAmount: e.target.value })} className="input-line w-full py-2 font-data-lg" />
            </div>
          </div>
          <button onClick={create} disabled={loading} className="btn-primary mt-5 w-full md:w-auto px-10 disabled:opacity-50">
            {loading ? "CREATING…" : "CREATE PAYROLL VAULT"}
          </button>
        </div>

        {/* List */}
        <div className="font-label-caps text-xs text-[var(--on-surface-variant)] mb-4">ACTIVE PAYROLL VAULTS</div>
        {vaults.length === 0 ? (
          <div className="border border-dashed border-[var(--ink)]/20 rounded-sm p-10 text-center text-sm text-[var(--on-surface-variant)]">
            No payroll vaults yet. Create one above.
          </div>
        ) : (
          <div className="space-y-6">
            {vaults.map((v) => {
              const pct = Math.min(100, Math.round((Number(v.releasedAmount) / Number(v.totalBudget)) * 100));
              const active = v.status === "ACTIVE";
              return (
                <div key={v.id} className="card-container p-6">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="font-data-sm text-xs text-[var(--on-surface-variant)]">CONTRIBUTOR</div>
                      <div className="font-data-sm text-sm break-all">{v.contributorAddress}</div>
                    </div>
                    <span className={`text-[10px] font-label-caps px-2 py-0.5 rounded ${v.status === "COMPLETED" ? "bg-[var(--brass)]/20 text-[var(--brass)]" : v.status === "CLAWBACK" ? "bg-[var(--signet)]/20 text-[var(--signet)]" : "bg-[var(--ink)]/10 text-[var(--ink)]"}`}>{v.status}</span>
                  </div>

                  <div className="flex justify-between text-xs font-label-caps text-[var(--on-surface-variant)] mb-1.5">
                    <span>STREAMED</span>
                    <span>{usd(v.releasedAmount)} / {usd(v.totalBudget)} USDCx</span>
                  </div>
                  <div className="progress-bar w-full mb-4"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>

                  <div className="flex gap-3">
                    <button onClick={() => checkIn(v.id)} disabled={!active || busyId === v.id} className="btn-primary text-sm py-2 px-5 disabled:opacity-40">
                      {busyId === v.id ? "RELEASING…" : `CHECK IN → RELEASE ${usd(v.intervalAmount)}`}
                    </button>
                    <button onClick={() => clawback(v.id)} disabled={!active || busyId === v.id} className="btn-secondary text-sm py-2 px-5 disabled:opacity-40">
                      MISSED CHECK-IN → CLAWBACK
                    </button>
                  </div>

                  {v.checkIns.length > 0 && (
                    <div className="mt-5 border-t border-[var(--ink)]/10 pt-3">
                      <div className="font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-2">RELEASE LOG</div>
                      <div className="space-y-1">
                        {v.checkIns.map((c) => (
                          <div key={c.id} className="flex justify-between text-xs font-data-sm">
                            <span>+{usd(c.amount || "0")} USDCx</span>
                            {c.explorerUrl ? <a href={c.explorerUrl} target="_blank" rel="noreferrer" className="underline text-[var(--on-surface-variant)] hover:text-[var(--ink)]">{c.txid?.slice(0, 10)}… ↗</a> : <span>—</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {v.clawbackExplorerUrl && (
                    <a href={v.clawbackExplorerUrl} target="_blank" rel="noreferrer" className="text-xs underline block mt-3 text-[var(--signet)]">Clawback tx ↗</a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-xs text-[var(--on-surface-variant)]">
          Uses the shared <code>src/lib/escrow.ts</code> custodian + real SIP-010 transfers — the same engine as the{" "}
          <Link href="/projects" className="underline text-[var(--ink)] hover:no-underline">Milestone vault</Link>.
        </div>
      </main>
    </div>
  );
}
