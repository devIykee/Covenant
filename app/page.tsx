import { Nav } from "@/src/components/Nav";
import Link from "next/link";
import { getDb } from "@/src/lib/db";
import { GuidedTour, type TourStep } from "@/src/components/GuidedTour";
import { formatUsdcx } from "@/src/lib/units";
import { formatDeadline } from "@/src/lib/format";

export const dynamic = "force-dynamic";

const HOME_TOUR: TourStep[] = [
  { selector: "#tour-home-cta", title: "Start here", body: "Browse open grant programs to apply as a builder, or create your own program — a pool that pays out milestone-by-milestone only when judges verify the work." },
  { selector: "#tour-home-active", title: "Live programs", body: "These are real grant programs from the database — click any card to see its conditions, pool size, and (once awarded) the builder's milestone schedule." },
  { selector: "#docs", title: "New to all this?", body: "The Docs page walks a total beginner from a blank machine to a real testnet transaction. Every click explained." },
];

function statusBadge(status: string) {
  if (status === "COMPLETED") return <span className="stamp-resolved font-label-caps text-[11px] px-3 py-1 font-bold rounded-sm border-2">COMPLETED</span>;
  if (status === "EXPIRED") return <span className="stamp-refunded font-label-caps text-[11px] px-3 py-1 font-bold rounded-sm border-2">EXPIRED</span>;
  if (status === "AWARDED") return <span className="stamp-locked font-label-caps text-[11px] px-3 py-1 font-bold rounded-sm">AWARDED</span>;
  if (status === "FUNDED_OPEN") return <span className="stamp-open font-label-caps text-[11px] px-3 py-1 font-bold rounded-sm border-2">OPEN</span>;
  return <span className="stamp-open font-label-caps text-[11px] px-3 py-1 font-bold rounded-sm border-2 opacity-60">DRAFT</span>;
}

export default async function CovenantHome() {
  const db = getDb();
  const programs = await db.grantProgram.findMany({
    where: { status: { in: ["FUNDED_OPEN", "AWARDED", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { applications: true, award: true },
  }).catch(() => [] as any[]);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 py-12 md:py-24">
        {/* Hero */}
        <header className="mb-14 md:mb-20 text-center max-w-3xl mx-auto">
          <div className="font-label-caps text-xs tracking-[0.12em] text-[var(--brass)] mb-4">MILESTONE-BASED GRANTS · ON STACKS + FLOWVAULT</div>
          <h1 className="font-display-lg-mobile md:font-display-lg text-[32px] md:text-[48px] leading-[40px] md:leading-[56px] tracking-[-0.02em] text-[var(--ink)] mb-6">
            Grants that release milestone-by-milestone, only when the work is verified.
          </h1>
          <p className="font-body-lg text-lg md:text-[18px] leading-[28px] text-[var(--on-surface-variant)]">
            A <strong className="text-[var(--ink)]">grantor</strong> locks a pool into a dedicated escrow. A <strong className="text-[var(--ink)]">builder</strong> is awarded the grant against a milestone schedule. As independent <strong className="text-[var(--ink)]">judges</strong> attest each milestone met, that payment is <strong className="text-[var(--ink)]">automatically released</strong> — and any milestone that lapses un-attested returns its funds to the grantor.
          </p>
          <div id="tour-home-cta" className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/projects" className="btn-primary">
              BROWSE PROGRAMS
            </Link>
            <Link href="/projects/create" className="btn-secondary">
              CREATE A PROGRAM
            </Link>
          </div>
        </header>

        {/* How it works — makes the conditional-routing logic visible before any deposit UI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16 max-w-4xl mx-auto">
          {[
            { n: "01", t: "Fund & lock the pool", d: "The grantor transfers the full pool into a per-program escrow custodian. A program can't be listed until its pool is locked on-chain." },
            { n: "02", t: "Award with milestones", d: "The grantor accepts one builder and defines the milestone schedule — each with its own deadline and % of the award." },
            { n: "03", t: "Verify → auto-disburse", d: "Judges attest a milestone met and its payment goes to the builder automatically. A lapsed milestone returns its funds to the grantor." },
          ].map((s) => (
            <div key={s.n} className="border border-[var(--ink)]/10 rounded-sm p-5">
              <div className="font-data-lg text-[var(--brass)] text-sm mb-2">{s.n}</div>
              <div className="font-semibold mb-1">{s.t}</div>
              <p className="text-sm text-[var(--on-surface-variant)]">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="w-full h-px border-t border-[var(--ink)]/20 mb-16" />

        {/* Program Grid - real programs from the DB */}
        <div id="tour-home-active" className="mb-8 flex items-end justify-between">
          <div>
            <div className="font-label-caps text-xs tracking-[0.08em] text-[var(--on-surface-variant)]">GRANT PROGRAMS</div>
            <div className="font-headline-md text-[24px]">Milestone-Gated Pools</div>
          </div>
          <Link href="/projects" className="text-xs font-label-caps tracking-widest text-[var(--ink)] hover:underline">VIEW ALL →</Link>
        </div>

        {programs.length === 0 ? (
          <div className="border border-dashed border-[var(--ink)]/20 rounded-sm p-12 text-center">
            <p className="text-[var(--on-surface-variant)] mb-4">No grant programs have been created yet.</p>
            <Link href="/projects/create" className="btn-primary inline-block">CREATE THE FIRST PROGRAM</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {programs.map((p: any) => {
              const awarded = p.status === "AWARDED" || p.status === "COMPLETED";
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="group">
                  <article className="relative bg-[var(--parchment)] border border-[var(--ink)]/10 p-6 rounded-sm shadow-[2px_2px_0px_rgba(11,29,29,0.05)] hover:bg-[var(--parchment)]/70 transition-colors flex flex-col h-full">
                    <div className="absolute top-4 right-4">{statusBadge(p.status)}</div>
                    <div className="mb-6">
                      <span className="font-data-sm text-[13px] text-[var(--on-surface-variant)] block mb-2">REF: {p.id.slice(0, 8).toUpperCase()}</span>
                      <h2 className="font-headline-md text-[24px] text-[var(--ink)] mb-2 pr-20 group-hover:underline">{p.title}</h2>
                      <p className="font-body-md text-sm text-[var(--on-surface-variant)] line-clamp-3">{p.description}</p>
                    </div>
                    <div className="mt-auto space-y-6">
                      <div className="border-t border-[var(--ink)]/10 pt-4 space-y-1">
                        <div className="flex justify-between py-1 border-b border-[var(--ink)]/10 text-sm">
                          <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">POOL</span>
                          <span className="font-data-sm text-[var(--ink)]">{formatUsdcx(p.totalPool)} USDCx</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[var(--ink)]/10 text-sm">
                          <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">HORIZON</span>
                          <span className="font-data-sm text-[var(--ink)]">{formatDeadline((p as any).programDeadlineAt, p.programDeadlineBlock)}</span>
                        </div>
                        <div className="flex justify-between py-1 text-sm">
                          <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">{awarded ? "BUILDER" : "APPLICANTS"}</span>
                          <span className="font-data-sm text-[var(--ink)]">{awarded ? "AWARDED" : p.applications.length}</span>
                        </div>
                      </div>
                      <div className="block w-full text-center border border-[var(--ink)] py-3 font-label-caps text-xs group-hover:bg-[var(--ink)] group-hover:text-[var(--parchment)] transition-colors">
                        {awarded ? "VIEW PROGRESS" : "VIEW & APPLY"}
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        {/* Secondary Vaults teaser */}
        <div id="docs" className="mt-20 pt-12 border-t border-[var(--ink)]/20">
          <div className="max-w-2xl mb-8">
            <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">NEW TO EVERYTHING?</div>
            <h3 className="font-headline-md text-2xl mb-2">Zero to Hero in 10 Minutes</h3>
            <p className="text-[var(--on-surface-variant)]">Follow the ridiculously detailed <Link href="/docs" className="underline text-[var(--ink)] hover:no-underline">beginner guide in Docs</Link>. It explains every click, every screen, how to get free testnet money, and exactly what you will see when things succeed.</p>
            <Link href="/docs" className="inline-block mt-4 btn-secondary text-xs">READ THE DOCS →</Link>
          </div>

          <div className="flex justify-between items-baseline mb-6">
            <div>
              <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">ADDITIONAL PROGRAMMABLE BEHAVIORS</div>
              <h3 className="font-headline-md text-2xl">Secondary Vault Types</h3>
            </div>
            <Link href="/vaults" className="font-label-caps text-xs text-[var(--ink)]">EXPLORE ALL VAULTS →</Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="border border-[var(--ink)]/10 p-6 rounded-sm">
              <div className="font-label-caps text-xs mb-1 text-[var(--on-surface-variant)]">PAYROLL VAULT</div>
              <div className="font-semibold mb-1">Streaming Payroll with Clawback</div>
              <p className="text-[var(--on-surface-variant)] text-sm">Time-locked streaming releases with activity check-ins. Missed check-in triggers clawback to payer.</p>
            </div>
            <div className="border border-[var(--ink)]/10 p-6 rounded-sm">
              <div className="font-label-caps text-xs mb-1 text-[var(--on-surface-variant)]">REPUTATION VAULT</div>
              <div className="font-semibold mb-1">Reputation-Weighted Split</div>
              <p className="text-[var(--on-surface-variant)] text-sm">Split distribution computed from historical on-chain success reputation of participants.</p>
            </div>
            <div className="border border-[var(--ink)]/10 p-6 rounded-sm">
              <div className="font-label-caps text-xs mb-1 text-[var(--on-surface-variant)]">INSURANCE VAULT</div>
              <div className="font-semibold mb-1">Parametric Insurance Pool</div>
              <p className="text-[var(--on-surface-variant)] text-sm">Pooled contributions released on judge-attested incident trigger or refunded on expiry.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--ink)]/20 py-8 mt-auto">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row justify-between text-xs font-label-caps text-[var(--on-surface-variant)] gap-y-2">
          <div>© {new Date().getFullYear()} Covenant Treasury Platform. Powered by Stacks + FlowVault.</div>
          <div className="flex gap-6">
            <Link href="/docs" className="hover:text-[var(--ink)]">DOCS</Link>
            <Link href="/vaults" className="hover:text-[var(--ink)]">VAULTS</Link>
            <a href="https://docs.flow-vault.dev" target="_blank" rel="noreferrer" className="hover:text-[var(--ink)]">FLOWVAULT DOCS ↗</a>
          </div>
        </div>
      </footer>

      <GuidedTour steps={HOME_TOUR} storageKey="covenant-home-tour-v2" />
    </div>
  );
}
