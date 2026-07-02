"use client";

import { Nav } from "@/src/components/Nav";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

interface Contribution { id: string; principal: string; amount: string }
interface Pool {
  id: string;
  title: string;
  returnOnExpiry: string;
  status: string;
  payouts: string;
  contributions: Contribution[];
}

const usd = (micro: string) => (Number(micro) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function InsuranceVaultPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [title, setTitle] = useState("Smart Contract Exploit Cover");
  const [returnOnExpiry, setReturnOnExpiry] = useState("REFUND");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [premium, setPremium] = useState<Record<string, { principal: string; amount: string }>>({});

  const load = useCallback(async () => {
    try { setPools(await (await fetch("/api/insurance")).json()); } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const myAddr = typeof window !== "undefined" ? localStorage.getItem("covenant-address") || "" : "";

  async function create() {
    setLoading(true);
    try {
      const res = await fetch("/api/insurance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, returnOnExpiry }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast.success("Insurance pool created.");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  async function contribute(id: string) {
    const p = premium[id] || { principal: myAddr, amount: "2" };
    setBusy(id);
    try {
      const res = await fetch(`/api/insurance/${id}/contribute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast.success("Premium added to pool.");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  }

  async function resolve(id: string, triggered: boolean) {
    setBusy(id);
    try {
      const res = await fetch(`/api/insurance/${id}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ triggered }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast.success(d.rolled ? "Pool rolled to next period." : triggered ? "Incident declared — claim paid out." : "Expired — premiums refunded.");
      if (d.payouts?.[0]?.explorerUrl) window.open(d.payouts[0].explorerUrl, "_blank");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-grow max-w-[1000px] mx-auto w-full px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display-lg text-3xl">Parametric Insurance Pool</h1>
          <span className="text-[10px] font-label-caps px-2 py-0.5 rounded bg-[#2f7d5b]/20 text-[#2f7d5b]">LIVE</span>
        </div>
        <p className="text-[var(--on-surface-variant)] max-w-2xl mb-8">
          Members pay premiums into a shared pool. If an <strong className="text-[var(--ink)]">incident is declared</strong>, the pool
          pays out to the claimant with a real on-chain transfer. If it expires with no incident, premiums are refunded (or rolled
          to the next period). Funds are held by the escrow custodian.
        </p>

        {/* Create */}
        <div className="card-container p-6 mb-10 max-w-2xl">
          <div className="font-label-caps text-xs text-[var(--on-surface-variant)] mb-4">CREATE INSURANCE POOL</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-line w-full py-2 mb-3" placeholder="Pool title" />
          <label className="block font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1">ON EXPIRY (NO INCIDENT)</label>
          <select value={returnOnExpiry} onChange={(e) => setReturnOnExpiry(e.target.value)} className="input-line w-full py-2 mb-4 bg-transparent text-sm">
            <option value="REFUND">Refund premiums pro-rata</option>
            <option value="ROLL">Roll pool into next period</option>
          </select>
          <button onClick={create} disabled={loading} className="btn-primary w-full md:w-auto px-10 disabled:opacity-50">{loading ? "CREATING…" : "CREATE POOL"}</button>
        </div>

        {/* List */}
        <div className="font-label-caps text-xs text-[var(--on-surface-variant)] mb-4">POOLS</div>
        {pools.length === 0 ? (
          <div className="border border-dashed border-[var(--ink)]/20 rounded-sm p-8 text-center text-sm text-[var(--on-surface-variant)]">No pools yet.</div>
        ) : (
          <div className="space-y-6">
            {pools.map((pool) => {
              const total = pool.contributions.reduce((s, c) => s + BigInt(c.amount), BigInt(0));
              const open = pool.status === "OPEN";
              const paid = (() => { try { return JSON.parse(pool.payouts || "[]"); } catch { return []; } })();
              const p = premium[pool.id] || { principal: myAddr, amount: "2" };
              return (
                <div key={pool.id} className="card-container p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold">{pool.title}</div>
                      <div className="text-xs text-[var(--on-surface-variant)]">Pool: {usd(total.toString())} USDCx · on expiry: {pool.returnOnExpiry}</div>
                    </div>
                    <span className={`text-[10px] font-label-caps px-2 py-0.5 rounded ${pool.status === "PAID_OUT" ? "bg-[var(--signet)]/20 text-[var(--signet)]" : pool.status === "OPEN" ? "bg-[var(--ink)]/10 text-[var(--ink)]" : "bg-[var(--brass)]/20 text-[var(--brass)]"}`}>{pool.status}</span>
                  </div>

                  {pool.contributions.length > 0 && (
                    <div className="text-xs space-y-0.5 mb-4">
                      {pool.contributions.map((c, i) => (
                        <div key={c.id} className="flex justify-between font-data-sm">
                          <span>{i === 0 ? "★ " : ""}{c.principal.slice(0, 12)}…{i === 0 ? " (claimant)" : ""}</span>
                          <span>{usd(c.amount)} USDCx</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {open && (
                    <>
                      <div className="flex gap-2 mb-3">
                        <input value={p.principal} onChange={(e) => setPremium({ ...premium, [pool.id]: { ...p, principal: e.target.value } })} placeholder="ST… member" className="input-line flex-1 py-2 text-xs font-data-sm" />
                        <input value={p.amount} onChange={(e) => setPremium({ ...premium, [pool.id]: { ...p, amount: e.target.value } })} className="input-line w-24 py-2 text-sm font-data-lg" />
                        <button onClick={() => contribute(pool.id)} disabled={busy === pool.id} className="btn-secondary text-xs px-4 disabled:opacity-40">ADD PREMIUM</button>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => resolve(pool.id, true)} disabled={busy === pool.id || total === BigInt(0)} className="btn-primary text-sm py-2 px-5 disabled:opacity-40">DECLARE INCIDENT → PAY OUT</button>
                        <button onClick={() => resolve(pool.id, false)} disabled={busy === pool.id || total === BigInt(0)} className="btn-secondary text-sm py-2 px-5 disabled:opacity-40">EXPIRE (NO INCIDENT)</button>
                      </div>
                    </>
                  )}

                  {paid.length > 0 && (
                    <div className="mt-4 border-t border-[var(--ink)]/10 pt-3">
                      <div className="font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1">PAYOUTS</div>
                      {paid.map((x: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs font-data-sm">
                          <span>{usd(x.amount)} → {x.recipient.slice(0, 10)}…</span>
                          <a href={x.explorerUrl} target="_blank" rel="noreferrer" className="underline text-[var(--on-surface-variant)] hover:text-[var(--ink)]">{x.txid?.slice(0, 10)}… ↗</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-xs text-[var(--on-surface-variant)]">
          Reuses the escrow custodian + real SIP-010 transfers — the same engine as the{" "}
          <Link href="/projects" className="underline text-[var(--ink)] hover:no-underline">Milestone vault</Link>.
        </div>
      </main>
    </div>
  );
}
