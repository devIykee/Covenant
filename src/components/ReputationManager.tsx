"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

interface Participant {
  principal: string;
  reputationAtTime: number;
  computedShareBps: number;
}
interface RepVault {
  id: string;
  title: string;
  totalAmount: string;
  status: string;
  payouts: string;
  participants: Participant[];
}

const usd = (micro: string) => (Number(micro) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function ReputationManager({ scores }: { scores: Record<string, number> }) {
  const [vaults, setVaults] = useState<RepVault[]>([]);
  const [title, setTitle] = useState("Core contributor split");
  const [amount, setAmount] = useState("6");
  const [addrs, setAddrs] = useState<string[]>(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setVaults(await (await fetch("/api/reputation")).json());
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const setAddr = (i: number, v: string) => setAddrs((p) => p.map((a, idx) => (idx === i ? v.trim() : a)));

  // Live preview of the computed split from known reputation scores.
  const valid = addrs.map((a) => a.trim()).filter(Boolean);
  const previewScores = valid.map((a) => scores[a] ?? 0);
  const totalScore = previewScores.reduce((a, b) => a + b, 0);
  const preview = valid.map((a, i) => {
    const pct = totalScore === 0 ? (valid.length ? 100 / valid.length : 0) : (previewScores[i] * 100) / totalScore;
    return { addr: a, score: previewScores[i], pct };
  });

  async function create() {
    setLoading(true);
    try {
      const res = await fetch("/api/reputation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, totalAmount: amount, participants: addrs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Reputation vault created with computed shares.");
      setAddrs(["", "", ""]);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function distribute(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/reputation/${id}/distribute`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Distribution failed");
      toast.success(`Distributed to ${data.payouts.length} participants.`);
      if (data.payouts?.[0]?.explorerUrl) window.open(data.payouts[0].explorerUrl, "_blank");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-10">
      {/* Create */}
      <div className="card-container p-6 max-w-2xl">
        <div className="font-label-caps text-xs text-[var(--on-surface-variant)] mb-4">CREATE REPUTATION VAULT</div>
        <label className="block font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1">TITLE</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-line w-full py-2 mb-3" />
        <label className="block font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1">TOTAL AMOUNT (USDCx)</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-line w-full py-2 mb-3 font-data-lg" />
        <label className="block font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1">PARTICIPANTS</label>
        {addrs.map((a, i) => (
          <input key={i} value={a} onChange={(e) => setAddr(i, e.target.value)} placeholder="ST… participant address" className="input-line w-full py-2 mb-2 font-data-sm" />
        ))}

        {preview.length >= 2 && (
          <div className="mt-3 border border-[var(--ink)]/10 rounded-sm p-3 text-xs" title="Shares are computed from each participant's reputation score; equal if nobody has a score yet.">
            <div className="font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-2">COMPUTED SPLIT (from reputation)</div>
            {preview.map((p) => (
              <div key={p.addr} className="flex justify-between font-data-sm py-0.5">
                <span className="truncate mr-2">{p.addr.slice(0, 10)}… (rep {p.score})</span>
                <span>{p.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={create} disabled={loading} className="btn-primary mt-4 w-full md:w-auto px-10 disabled:opacity-50">
          {loading ? "CREATING…" : "CREATE REPUTATION VAULT"}
        </button>
      </div>

      {/* List */}
      <div className="font-label-caps text-xs text-[var(--on-surface-variant)] mt-10 mb-4">REPUTATION VAULTS</div>
      {vaults.length === 0 ? (
        <div className="border border-dashed border-[var(--ink)]/20 rounded-sm p-8 text-center text-sm text-[var(--on-surface-variant)]">None yet.</div>
      ) : (
        <div className="space-y-5">
          {vaults.map((v) => {
            const paid = (() => { try { return JSON.parse(v.payouts || "[]"); } catch { return []; } })();
            return (
              <div key={v.id} className="card-container p-6 max-w-2xl">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold">{v.title}</div>
                    <div className="text-xs text-[var(--on-surface-variant)]">{usd(v.totalAmount)} USDCx pool</div>
                  </div>
                  <span className={`text-[10px] font-label-caps px-2 py-0.5 rounded ${v.status === "DISTRIBUTED" ? "bg-[var(--brass)]/20 text-[var(--brass)]" : "bg-[var(--ink)]/10 text-[var(--ink)]"}`}>{v.status}</span>
                </div>
                <div className="space-y-1 text-xs mb-4">
                  {v.participants.map((p) => (
                    <div key={p.principal} className="flex justify-between font-data-sm">
                      <span className="truncate mr-2">{p.principal.slice(0, 12)}… (rep {p.reputationAtTime})</span>
                      <span>{(p.computedShareBps / 100).toFixed(1)}% · {usd(((BigInt(v.totalAmount) * BigInt(p.computedShareBps)) / BigInt(10000)).toString())} USDCx</span>
                    </div>
                  ))}
                </div>
                {v.status === "OPEN" ? (
                  <button onClick={() => distribute(v.id)} disabled={busy === v.id} className="btn-primary text-sm py-2 px-6 disabled:opacity-40">
                    {busy === v.id ? "DISTRIBUTING…" : "DISTRIBUTE PRO-RATA (REAL TRANSFERS)"}
                  </button>
                ) : (
                  <div className="border-t border-[var(--ink)]/10 pt-3">
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
    </div>
  );
}
