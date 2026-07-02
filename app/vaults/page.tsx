import { Nav } from "@/src/components/Nav";
import Link from "next/link";

export default function SecondaryVaults() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="max-w-[1200px] mx-auto w-full px-6 py-12">
        <h1 className="font-display-lg text-3xl mb-2">Secondary Vaults</h1>
        <p className="text-[var(--on-surface-variant)] max-w-lg">Specialized ledgers for operational and protective asset management using FlowVault primitives.</p>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payroll */}
          <div className="card-container p-6">
            <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">PAYROLL VAULT</div>
            <div className="text-xl font-semibold mt-1 mb-2">Streaming Payroll + Clawback</div>
            <p className="text-sm text-[var(--on-surface-variant)]">Investor funds a locked vault. Releases stream at fixed intervals. Contributor must check-in each period or remaining funds clawback.</p>
            <Link href="/vaults/payroll" className="mt-4 block btn-secondary text-xs py-2 w-full text-center">OPEN PAYROLL VAULT</Link>
          </div>

          {/* Reputation */}
          <div className="card-container p-6">
            <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">REPUTATION VAULT</div>
            <div className="text-xl font-semibold mt-1 mb-2">Reputation-Weighted Split</div>
            <p className="text-sm text-[var(--on-surface-variant)]">Splits computed automatically from historical success reputation. Higher reputation = larger share of resolution payout.</p>
            <Link href="/vaults/reputation" className="mt-4 block btn-secondary text-xs py-2 w-full text-center">CREATE REPUTATION VAULT</Link>
          </div>

          {/* Insurance */}
          <div className="card-container p-6">
            <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">INSURANCE VAULT</div>
            <div className="text-xl font-semibold mt-1 mb-2">Parametric Insurance Pool</div>
            <p className="text-sm text-[var(--on-surface-variant)]">Pooled premiums. Trigger = judge multisig incident declaration. Payouts or refund at expiry.</p>
            <Link href="/vaults/insurance" className="mt-4 block btn-secondary text-xs py-2 w-full text-center">CREATE INSURANCE POOL</Link>
          </div>
        </div>

        <div className="mt-12 text-xs text-[var(--on-surface-variant)]">All vaults use the shared <code>src/lib/escrow.ts</code> + FlowVault primitives for composability.</div>
      </main>
    </div>
  );
}
