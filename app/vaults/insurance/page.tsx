import { Nav } from "@/src/components/Nav";
import Link from "next/link";

export default function InsuranceVault() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-grow max-w-2xl mx-auto w-full px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display-lg text-2xl">Parametric Insurance Pool</h1>
          <span className="text-[10px] font-label-caps px-2 py-0.5 rounded bg-[var(--brass)]/20 text-[var(--brass)]">PREVIEW</span>
        </div>
        <p className="text-[var(--on-surface-variant)] mb-8">
          Multiple users pay premiums into a shared pool. If an incident is declared by the judge multisig
          (the same attestation mechanism the live Milestone vault uses), the pool pays out pro-rata to claimants;
          otherwise contributions are refunded or rolled into the next period at expiry.
        </p>

        <div className="card-container p-6 opacity-90">
          <input className="input-line w-full mb-3 py-2" placeholder="Pool title" defaultValue="Smart Contract Exploit Cover" disabled />
          <div className="text-xs mb-4 text-[var(--on-surface-variant)]">Trigger: judge multisig &ldquo;INCIDENT_DECLARED&rdquo;</div>
          <div className="w-full border border-dashed border-[var(--ink)]/25 rounded-sm text-center py-3 text-xs font-label-caps text-[var(--on-surface-variant)]">
            PREVIEW — NOT YET WIRED TO TESTNET
          </div>
        </div>

        <div className="mt-6 text-sm text-[var(--on-surface-variant)]">
          The fully working, on-chain feature today is the{" "}
          <Link href="/projects" className="underline text-[var(--ink)] hover:no-underline">Milestone-Gated Vault</Link>. Insurance
          reuses its escrow + judge-attestation modules and is on the roadmap.
        </div>
      </main>
    </div>
  );
}
