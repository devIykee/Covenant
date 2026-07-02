import { Nav } from "@/src/components/Nav";
import Link from "next/link";

export default function CovenantHome() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 py-12 md:py-24">
        {/* Hero */}
        <header className="mb-16 md:mb-24 text-center max-w-3xl mx-auto">
          <h1 className="font-display-lg-mobile md:font-display-lg text-[32px] md:text-[48px] leading-[40px] md:leading-[56px] tracking-[-0.02em] text-[var(--ink)] mb-6">
            Programmable Trust.
          </h1>
          <p className="font-body-lg text-lg md:text-[18px] leading-[28px] text-[var(--on-surface-variant)]">
            Immutable ledgers and mathematically verified agreements. Secure your assets with institutional-grade smart contracts, formalized on-chain.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/projects" className="btn-primary">
              BROWSE COVENANTS
            </Link>
            <Link href="/projects/create" className="btn-secondary">
              CREATE COVENANT
            </Link>
          </div>
        </header>

        <div className="w-full h-px border-t border-[var(--ink)]/20 mb-16" />

        {/* Project Grid - static demo cards matching design + link to live */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="font-label-caps text-xs tracking-[0.08em] text-[var(--on-surface-variant)]">ACTIVE COVENANTS</div>
            <div className="font-headline-md text-[24px]">Milestone-Gated Vaults</div>
          </div>
          <Link href="/projects" className="text-xs font-label-caps tracking-widest text-[var(--ink)] hover:underline">VIEW ALL →</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Demo Card 1 - OPEN */}
          <article className="relative bg-[var(--parchment)] border border-[var(--ink)]/10 p-6 rounded-sm shadow-[2px_2px_0px_rgba(11,29,29,0.05)] hover:bg-[var(--parchment)]/70 transition-colors flex flex-col h-full">
            <div className="absolute top-4 right-4 stamp-open font-label-caps text-[11px] px-3 py-1 font-bold rounded-sm border-2">
              OPEN
            </div>
            <div className="mb-6">
              <span className="font-data-sm text-[13px] text-[var(--on-surface-variant)] block mb-2">REF: COV-2024-A1</span>
              <h2 className="font-headline-md text-[24px] text-[var(--ink)] mb-2">Artemis Liquidity Pool</h2>
              <p className="font-body-md text-sm text-[var(--on-surface-variant)] line-clamp-3">
                Establishing a decentralized treasury reserve for the Artemis protocol, utilizing multi-signature consensus for tranche releases.
              </p>
            </div>
            <div className="mt-auto space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">FUNDING PROGRESS</span>
                  <span className="font-data-lg text-[16px] text-[var(--ink)]">450,000 / 1,000,000 USDCx</span>
                </div>
                <div className="progress-bar w-full"><div className="progress-fill w-[45%]" /></div>
              </div>
              <div className="border-t border-[var(--ink)]/10 pt-4 space-y-1">
                <div className="flex justify-between py-1 border-b border-[var(--ink)]/10 text-sm">
                  <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">DEADLINE</span>
                  <span className="font-data-sm text-[var(--ink)]">14D 08H 22M</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">PARTICIPANTS</span>
                  <span className="font-data-sm text-[var(--ink)]">128 Signatories</span>
                </div>
              </div>
              <Link href="/projects" className="block w-full text-center border border-[var(--ink)] py-3 font-label-caps text-xs hover:bg-[var(--ink)] hover:text-[var(--parchment)] transition-colors">
                REVIEW TERMS
              </Link>
            </div>
          </article>

          {/* Card 2 - LOCKED */}
          <article className="relative bg-[var(--parchment)] border border-[var(--ink)]/10 p-6 rounded-sm flex flex-col h-full opacity-80">
            <div className="absolute top-4 right-4 stamp-locked font-label-caps text-[11px] px-3 py-1 font-bold rounded-sm">
              LOCKED
            </div>
            <div className="mb-6">
              <span className="font-data-sm text-xs text-[var(--on-surface-variant)] block mb-2">REF: COV-2023-X9</span>
              <h2 className="font-headline-md text-[24px] text-[var(--ink)] mb-2">Zenith Staking Escrow</h2>
              <p className="font-body-md text-sm text-[var(--on-surface-variant)] line-clamp-3">
                Locked liquidity for Zenith validators. Funds are currently in staking period with time-locked withdrawal conditions met.
              </p>
            </div>
            <div className="mt-auto space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">FUNDING PROGRESS</span>
                  <span className="font-data-lg text-[16px]">2,500,000 / 2,500,000 USDCx</span>
                </div>
                <div className="progress-bar w-full"><div className="progress-fill w-full" /></div>
              </div>
              <div className="border-t border-[var(--ink)]/10 pt-4">
                <div className="flex justify-between py-1 border-b border-[var(--ink)]/10 text-sm bg-[var(--parchment)]/50">
                  <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">UNLOCK DATE</span>
                  <span className="font-data-sm text-[var(--ink)]">2025.10.15</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">PARTICIPANTS</span>
                  <span className="font-data-sm text-[var(--ink)]">42 Signatories</span>
                </div>
              </div>
              <div className="w-full border border-[var(--ink)]/20 bg-[var(--ink)]/5 text-[var(--on-surface-variant)] font-label-caps text-xs py-3 text-center cursor-not-allowed">
                VIEW LEDGER
              </div>
            </div>
          </article>

          {/* Card 3 - RESOLVED */}
          <article className="relative bg-[var(--parchment)] border border-[var(--ink)]/10 p-6 rounded-sm flex flex-col h-full">
            <div className="absolute top-4 right-4 stamp-resolved font-label-caps text-[11px] px-3 py-1 font-bold rounded-sm border-2">
              RESOLVED
            </div>
            <div className="mb-6">
              <span className="font-data-sm text-xs text-[var(--on-surface-variant)] block mb-2">REF: COV-2023-B2</span>
              <h2 className="font-headline-md text-[24px] text-[var(--ink)] mb-2">Vanguard Treasury</h2>
              <p className="font-body-md text-sm text-[var(--on-surface-variant)] line-clamp-3">
                Initial treasury bootstrap for Vanguard DAO. All milestones achieved and funds fully disbursed according to contract terms.
              </p>
            </div>
            <div className="mt-auto space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">FINAL DISBURSEMENT</span>
                  <span className="font-data-lg text-[16px]">800,000 USDCx</span>
                </div>
                <div className="progress-bar w-full"><div className="progress-brass w-full" /></div>
              </div>
              <div className="border-t border-[var(--ink)]/10 pt-4">
                <div className="flex justify-between py-1 border-b border-[var(--ink)]/10 text-sm">
                  <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">RESOLUTION DATE</span>
                  <span className="font-data-sm text-[var(--ink)]">2024.01.12</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span className="font-label-caps text-xs text-[var(--on-surface-variant)]">STATUS</span>
                  <span className="font-data-sm text-[var(--ink)]">Executed</span>
                </div>
              </div>
              <Link href="/projects" className="block w-full border border-[var(--ink)] text-center py-3 font-label-caps text-xs hover:bg-[var(--ink)] hover:text-[var(--parchment)] transition-colors">
                VERIFY ON-CHAIN
              </Link>
            </div>
          </article>
        </div>

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
              <p className="text-[var(--on-surface-variant)] text-sm">Time-locked streaming releases with activity check-ins. Missed check-in triggers clawback to investor.</p>
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
    </div>
  );
}
