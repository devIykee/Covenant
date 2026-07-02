"use client";
import { Nav } from "@/src/components/Nav";
import { toast } from "sonner";

export default function InsuranceVault() {
  return (
    <div>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-headline-md mb-2">Parametric Insurance Pool</h1>
        <div className="card-container p-6">
          <input className="input-line w-full mb-3 py-2" placeholder="Pool title" defaultValue="Smart Contract Exploit Cover" />
          <div className="text-xs mb-4 text-[var(--on-surface-variant)]">Trigger: Judge multisig "INCIDENT_DECLARED"</div>
          <button onClick={() => toast.success("Insurance pool initialized. Contributions tracked. Trigger reuses judge attestation.")} className="btn-primary w-full">CREATE INSURANCE POOL</button>
        </div>
      </main>
    </div>
  );
}
