import { Nav } from "@/src/components/Nav";
import Link from "next/link";

export default function PayrollVault() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-grow max-w-2xl mx-auto w-full px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display-lg text-2xl">Streaming Payroll + Clawback</h1>
          <span className="text-[10px] font-label-caps px-2 py-0.5 rounded bg-[var(--brass)]/20 text-[var(--brass)]">PREVIEW</span>
        </div>
        <p className="text-[var(--on-surface-variant)] mb-8">
          Funds are locked in FlowVault and released to a contributor at fixed intervals. If the contributor misses an
          activity check-in, the remaining locked balance is clawed back to the investor. This uses the same escrow +
          FlowVault lock primitive as the live Milestone vault.
        </p>

        <div className="card-container p-6 opacity-90">
          <input placeholder="Contributor STX address" className="input-line w-full mb-4 py-2" disabled />
          <input placeholder="Total budget (USDCx)" className="input-line w-full mb-4 py-2" defaultValue="25000" disabled />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input placeholder="Interval amount" className="input-line py-2" defaultValue="5000" disabled />
            <input placeholder="Check-in window (blocks)" className="input-line py-2" defaultValue="144" disabled />
          </div>
          <div className="w-full border border-dashed border-[var(--ink)]/25 rounded-sm text-center py-3 text-xs font-label-caps text-[var(--on-surface-variant)]">
            PREVIEW — NOT YET WIRED TO TESTNET
          </div>
        </div>

        <div className="mt-6 text-sm text-[var(--on-surface-variant)]">
          The fully working, on-chain feature today is the{" "}
          <Link href="/projects" className="underline text-[var(--ink)] hover:no-underline">Milestone-Gated Vault</Link>. Payroll
          reuses its escrow module and is on the roadmap.
        </div>
      </main>
    </div>
  );
}
