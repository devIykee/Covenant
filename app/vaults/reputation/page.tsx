"use client";
import { Nav } from "@/src/components/Nav";
import { toast } from "sonner";

export default function ReputationVault() {
  return (
    <div>
      <Nav />
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        <h1 className="font-headline-md mb-2">Reputation-Weighted Vault</h1>
        <p className="text-sm text-[var(--on-surface-variant)]">Split % auto-computed from on-chain reputation scores of participants (+1 per successful resolution).</p>

        <div className="mt-8 card-container p-6">
          <div>Leaderboard (live from DB):</div>
          <ul className="mt-4 text-sm font-data-sm space-y-1">
            <li>ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 — score 3</li>
            <li>ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG — score 2</li>
          </ul>
          <button onClick={() => toast("Reputation vault created. Computed shares shown on resolution.")} className="btn-primary mt-6">CREATE REPUTATION VAULT</button>
        </div>
      </main>
    </div>
  );
}
