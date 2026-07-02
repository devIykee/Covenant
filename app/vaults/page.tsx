import { Nav } from "@/src/components/Nav";
import Link from "next/link";

export default function SecondaryVaults() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="max-w-[1200px] mx-auto w-full px-6 py-12">
        <h1 className="font-display-lg text-3xl mb-2">Secondary Vaults</h1>
        <p className="text-[var(--on-surface-variant)] max-w-xl">
          Additional programmable-money behaviors built on the same escrow + FlowVault primitives as the live
          Milestone vault. These three are <strong className="text-[var(--ink)]">previews</strong> — the fully on-chain
          feature today is the <Link href="/projects" className="underline text-[var(--ink)] hover:no-underline">Milestone-Gated Vault</Link>.
        </p>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payroll */}
          <div className="card-container p-6">
            <div className="flex items-center justify-between">
              <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">PAYROLL VAULT</div>
              <span className="text-[9px] font-label-caps px-1.5 py-0.5 rounded bg-[#2f7d5b]/20 text-[#2f7d5b]">LIVE</span>
            </div>
            <div className="text-xl font-semibold mt-1 mb-2">Streaming Payroll + Clawback</div>
            <p className="text-sm text-[var(--on-surface-variant)]">Budget streams to a contributor. Each check-in releases a real on-chain USDCx payment; a missed check-in claws the remainder back to the payer.</p>
            <Link href="/vaults/payroll" className="mt-4 block btn-primary text-xs py-2 w-full text-center">OPEN PAYROLL VAULT</Link>
          </div>

          {/* Reputation */}
          <div className="card-container p-6">
            <div className="flex items-center justify-between">
              <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">REPUTATION VAULT</div>
              <span className="text-[9px] font-label-caps px-1.5 py-0.5 rounded bg-[var(--brass)]/20 text-[var(--brass)]">LIVE LEADERBOARD</span>
            </div>
            <div className="text-xl font-semibold mt-1 mb-2">Reputation-Weighted Split</div>
            <p className="text-sm text-[var(--on-surface-variant)]">Splits computed automatically from historical success reputation. Higher reputation = larger share of resolution payout.</p>
            <Link href="/vaults/reputation" className="mt-4 block btn-secondary text-xs py-2 w-full text-center">VIEW REPUTATION LEADERBOARD</Link>
          </div>

          {/* Insurance */}
          <div className="card-container p-6">
            <div className="flex items-center justify-between">
              <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">INSURANCE VAULT</div>
              <span className="text-[9px] font-label-caps px-1.5 py-0.5 rounded bg-[var(--brass)]/20 text-[var(--brass)]">PREVIEW</span>
            </div>
            <div className="text-xl font-semibold mt-1 mb-2">Parametric Insurance Pool</div>
            <p className="text-sm text-[var(--on-surface-variant)]">Pooled premiums. Trigger = judge multisig incident declaration. Payouts or refund at expiry.</p>
            <Link href="/vaults/insurance" className="mt-4 block btn-secondary text-xs py-2 w-full text-center">VIEW INSURANCE POOL</Link>
          </div>
        </div>

        <div className="mt-12 text-xs text-[var(--on-surface-variant)]">All vaults use the shared <code>src/lib/escrow.ts</code> + FlowVault primitives for composability.</div>
      </main>
    </div>
  );
}
