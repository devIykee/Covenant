"use client";

import { Nav } from "@/src/components/Nav";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { formatUsdcx } from "@/src/lib/units";
import { NextStep, type Role } from "@/src/components/NextStep";

interface DashMilestone { index: number; name: string; status: string; percentBps: number; amount: string }
interface DashAward { builderAddress: string; amount: string; status: string; activeMilestoneIndex: number; milestones: DashMilestone[] }
interface DashProgram {
  id: string;
  title: string;
  status: string;
  totalPool: string;
  applicationCount: number;
  myApplicationStatus?: string | null;
  award: DashAward | null;
}

const usd = (m: string) => formatUsdcx(m);

function badge(status: string) {
  const map: Record<string, string> = {
    COMPLETED: "bg-[var(--brass)]/20 text-[var(--brass)]",
    EXPIRED: "bg-[var(--signet)]/20 text-[var(--signet)]",
    AWARDED: "bg-[var(--ink)]/15 text-[var(--ink)]",
  };
  return <span className={`text-[10px] font-label-caps px-2 py-0.5 rounded ${map[status] || "bg-[var(--ink)]/10 text-[var(--ink)]"}`}>{status.replace("_", " ")}</span>;
}

function activeMs(p: DashProgram) {
  if (!p.award) return null;
  const m = p.award.milestones.find((x) => x.index === p.award!.activeMilestoneIndex);
  return m ? { index: m.index, name: m.name, status: m.status } : null;
}

export default function Dashboard() {
  const [addr, setAddr] = useState<string | null>(null);
  const [data, setData] = useState<{ asGrantor: DashProgram[]; asBuilder: DashProgram[]; asJudge: DashProgram[] }>({ asGrantor: [], asBuilder: [], asJudge: [] });

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

  if (!addr) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-grow max-w-[1000px] mx-auto w-full px-6 py-24 text-center">
          <h1 className="font-display-lg text-3xl mb-3">Your Dashboard</h1>
          <p className="text-[var(--on-surface-variant)]">Connect your wallet (top-right) to see the programs you fund, build, and judge.</p>
        </main>
      </div>
    );
  }

  function Card({ p, role }: { p: DashProgram; role: Role }) {
    return (
      <div className="card-container p-6">
        <div className="flex justify-between items-start gap-3 mb-3">
          <Link href={`/projects/${p.id}`} className="font-semibold hover:underline">{p.title}</Link>
          {badge(p.status)}
        </div>
        <div className="flex justify-between text-xs text-[var(--on-surface-variant)] mb-4">
          <span>Pool <strong className="text-[var(--ink)] font-data-sm">{usd(p.totalPool)} USDCx</strong></span>
          {p.award ? <span>Builder <span className="font-data-sm">{p.award.builderAddress.slice(0, 8)}…</span></span> : <span>{p.applicationCount} applicant{p.applicationCount === 1 ? "" : "s"}</span>}
        </div>
        <NextStep role={role} id={p.id} status={p.status} applicationStatus={p.myApplicationStatus} activeMilestone={activeMs(p)} linkToDetail />
      </div>
    );
  }

  const Empty = ({ children }: { children: React.ReactNode }) => (
    <div className="border border-dashed border-[var(--ink)]/20 rounded-sm p-8 text-center text-sm text-[var(--on-surface-variant)]">{children}</div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-grow max-w-[1000px] mx-auto w-full px-6 py-12">
        <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">DASHBOARD</div>
        <h1 className="font-display-lg text-3xl mb-1">Your programs</h1>
        <p className="text-sm text-[var(--on-surface-variant)] mb-10 font-data-sm">{addr.slice(0, 10)}…{addr.slice(-4)}</p>

        <section className="mb-12">
          <h2 className="font-headline-md text-xl mb-1">Programs you fund (grantor)</h2>
          <p className="text-sm text-[var(--on-surface-variant)] mb-5">Pools you created — fund escrow, award a builder, then milestones run automatically.</p>
          {data.asGrantor.length === 0 ? (
            <Empty>You haven&rsquo;t created any programs. <Link href="/projects/create" className="underline text-[var(--ink)]">Create one</Link>.</Empty>
          ) : (
            <div className="space-y-5">{data.asGrantor.map((p) => <Card key={p.id} p={p} role="grantor" />)}</div>
          )}
        </section>

        <section className="mb-12">
          <h2 className="font-headline-md text-xl mb-1">Programs you build (builder)</h2>
          <p className="text-sm text-[var(--on-surface-variant)] mb-5">Grants you applied to or were awarded.</p>
          {data.asBuilder.length === 0 ? (
            <Empty>You haven&rsquo;t applied to anything yet. <Link href="/projects" className="underline text-[var(--ink)]">Browse programs</Link>.</Empty>
          ) : (
            <div className="space-y-5">{data.asBuilder.map((p) => <Card key={p.id} p={p} role="builder" />)}</div>
          )}
        </section>

        <section>
          <h2 className="font-headline-md text-xl mb-1">Programs you judge</h2>
          <p className="text-sm text-[var(--on-surface-variant)] mb-5">Grants where you attest milestone completion.</p>
          {data.asJudge.length === 0 ? (
            <Empty>You&rsquo;re not a judge on any program yet.</Empty>
          ) : (
            <div className="space-y-5">{data.asJudge.map((p) => <Card key={p.id} p={p} role="judge" />)}</div>
          )}
        </section>
      </main>
    </div>
  );
}
