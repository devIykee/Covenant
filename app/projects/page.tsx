import { Nav } from "@/src/components/Nav";
import Link from "next/link";
import { db } from "@/src/lib/db";
import { getExplorerTxUrl } from "@/src/lib/flowvault";

export const dynamic = "force-dynamic";

export default async function ProjectsList() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      contributions: true,
    },
  });

  const getStatusBadge = (status: string) => {
    if (status === "RESOLVED_SUCCESS") return <span className="stamp-resolved px-3 py-0.5 text-[10px] font-bold">RESOLVED</span>;
    if (status === "RESOLVED_FAILURE") return <span className="stamp-refunded px-3 py-0.5 text-[10px] font-bold">REFUNDED</span>;
    if (status === "POOLED_LOCKED" || status === "DISPUTE_WINDOW") return <span className="stamp-locked px-3 py-0.5 text-[10px] font-bold">LOCKED</span>;
    return <span className="stamp-open px-3 py-0.5 text-[10px] font-bold border-2">OPEN</span>;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-grow max-w-[1200px] mx-auto w-full px-6 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="font-label-caps text-xs tracking-[0.08em] text-[var(--on-surface-variant)]">COVENANT LEDGER</div>
            <h1 className="font-display-lg-mobile md:font-display-lg text-3xl md:text-[32px]">All Covenants</h1>
          </div>
          <Link href="/projects/create" className="btn-primary text-sm py-2 px-5">+ NEW COVENANT</Link>
        </div>

        {projects.length === 0 ? (
          <div className="border border-[var(--ink)]/10 p-12 text-center">
            <p className="text-[var(--on-surface-variant)]">No covenants yet. Be the first to create one.</p>
            <Link href="/projects/create" className="btn-secondary mt-4 inline-block">CREATE FIRST COVENANT</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((p) => {
              const raised = p.contributions.reduce((sum, c) => sum + BigInt(c.amount), BigInt(0));
              const goal = BigInt(p.fundingGoal);
              const pct = goal > BigInt(0) ? Number((raised * BigInt(100)) / goal) : 0;
              const deadlineLabel = `Block ${p.deadlineBlock}`;

              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="group">
                  <article className="card-container p-6 flex flex-col h-full hover:bg-white/70 dark:hover:bg-white/5 transition-colors">
                    <div className="flex justify-between mb-4">
                      <span className="font-data-sm text-xs text-[var(--on-surface-variant)]">ID: {p.id.slice(0, 8)}</span>
                      {getStatusBadge(p.status)}
                    </div>

                    <h3 className="font-headline-md text-xl mb-2 group-hover:underline">{p.title}</h3>
                    <p className="text-sm text-[var(--on-surface-variant)] line-clamp-2 flex-grow">{p.description}</p>

                    <div className="mt-6 space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1.5 font-label-caps text-[var(--on-surface-variant)]">
                          <span>FUNDING</span>
                          <span>{(Number(raised) / 1e6).toFixed(0)}k / {(Number(goal) / 1e6).toFixed(0)}k USDCx</span>
                        </div>
                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                      </div>

                      <div className="text-xs flex justify-between border-t border-[var(--ink)]/10 pt-3">
                        <div>
                          <div className="text-[var(--on-surface-variant)]">DEADLINE</div>
                          <div className="font-data-sm text-[var(--ink)]">{deadlineLabel}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[var(--on-surface-variant)]">INVESTORS</div>
                          <div className="font-data-sm text-[var(--ink)]">{p.contributions.length}</div>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-[var(--ink)]/10">
          <Link href="/vaults" className="font-label-caps text-xs">EXPLORE SECONDARY VAULTS (Payroll • Reputation • Insurance) →</Link>
        </div>
      </main>

      <footer className="mt-auto border-t border-[var(--ink)]/20 py-6 text-xs text-center text-[var(--on-surface-variant)]">
        Covenant • FlowVault on Stacks testnet
      </footer>
    </div>
  );
}
