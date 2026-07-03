import { Nav } from "@/src/components/Nav";
import Link from "next/link";
import { getDb } from "@/src/lib/db";
import { GuidedTour, type TourStep } from "@/src/components/GuidedTour";
import { formatUsdcx } from "@/src/lib/units";
import { formatDeadline } from "@/src/lib/format";

export const dynamic = "force-dynamic";

const PROJECTS_TOUR: TourStep[] = [
  { selector: "#tour-new-covenant", title: "Create a program", body: "Start a new grant program: set the pool size, a horizon, and the eligibility conditions. You'll fund and lock the pool before it goes public." },
  { selector: "#tour-projects-grid", title: "Open programs", body: "Every program shows its pool size, status, and applicant count. Click one to apply as a builder, or to manage it if you're the grantor." },
];

export default async function ProjectsList() {
  const db = getDb();
  const programs = await db.grantProgram.findMany({
    where: { status: { in: ["FUNDED_OPEN", "AWARDED", "COMPLETED", "EXPIRED"] } },
    orderBy: { createdAt: "desc" },
    include: { applications: true, award: true },
  });

  const getStatusBadge = (status: string) => {
    if (status === "COMPLETED") return <span className="stamp-resolved px-3 py-0.5 text-[10px] font-bold">COMPLETED</span>;
    if (status === "EXPIRED") return <span className="stamp-refunded px-3 py-0.5 text-[10px] font-bold">EXPIRED</span>;
    if (status === "AWARDED") return <span className="stamp-locked px-3 py-0.5 text-[10px] font-bold">AWARDED</span>;
    return <span className="stamp-open px-3 py-0.5 text-[10px] font-bold border-2">OPEN</span>;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-grow max-w-[1200px] mx-auto w-full px-6 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="font-label-caps text-xs tracking-[0.08em] text-[var(--on-surface-variant)]">GRANT LEDGER</div>
            <h1 className="font-display-lg-mobile md:font-display-lg text-3xl md:text-[32px]">All Programs</h1>
          </div>
          <Link id="tour-new-covenant" href="/projects/create" className="btn-primary text-sm py-2 px-5">+ NEW PROGRAM</Link>
        </div>

        <div id="tour-projects-grid">
        {programs.length === 0 ? (
          <div className="border border-[var(--ink)]/10 p-12 text-center">
            <p className="text-[var(--on-surface-variant)]">No programs yet. Be the first to create one.</p>
            <Link href="/projects/create" className="btn-secondary mt-4 inline-block">CREATE FIRST PROGRAM</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {programs.map((p: any) => {
              const awarded = p.status === "AWARDED" || p.status === "COMPLETED";
              const deadlineLabel = formatDeadline(p.programDeadlineAt as any, p.programDeadlineBlock);

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
                      <div className="flex justify-between text-xs font-label-caps text-[var(--on-surface-variant)]">
                        <span>POOL</span>
                        <span className="font-data-sm text-[var(--ink)]">{formatUsdcx(p.totalPool)} USDCx</span>
                      </div>

                      <div className="text-xs flex justify-between border-t border-[var(--ink)]/10 pt-3">
                        <div>
                          <div className="text-[var(--on-surface-variant)]">HORIZON</div>
                          <div className="font-data-sm text-[var(--ink)]">{deadlineLabel}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[var(--on-surface-variant)]">{awarded ? "BUILDER" : "APPLICANTS"}</div>
                          <div className="font-data-sm text-[var(--ink)]">{awarded ? "AWARDED" : p.applications.length}</div>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--ink)]/10">
          <Link href="/vaults" className="font-label-caps text-xs">EXPLORE SECONDARY VAULTS (Payroll • Reputation • Insurance) →</Link>
        </div>
      </main>

      <GuidedTour steps={PROJECTS_TOUR} storageKey="covenant-programs-tour-v2" />

      <footer className="mt-auto border-t border-[var(--ink)]/20 py-6 text-xs text-center text-[var(--on-surface-variant)]">
        Covenant • FlowVault on Stacks testnet
      </footer>
    </div>
  );
}
