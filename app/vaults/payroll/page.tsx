"use client";
import { Nav } from "@/src/components/Nav";
import { useState } from "react";
import { toast } from "sonner";

export default function PayrollVault() {
  const [loading, setLoading] = useState(false);

  async function createPayroll() {
    setLoading(true);
    // Demo only: in real call server action that uses escrow to set rules + deposit streaming schedule
    toast.success("Payroll Vault created (demo). Custodian will stream via scheduled releases + check-in tracking.");
    setLoading(false);
  }

  return (
    <div>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-display-lg text-2xl mb-2">Create Payroll Vault</h1>
        <p className="text-[var(--on-surface-variant)] mb-8">Funds locked. Released in scheduled intervals. Contributor must check-in.</p>

        <div className="card-container p-6">
          <input placeholder="Contributor STX address" className="input-line w-full mb-4 py-2" />
          <input placeholder="Total budget (USDCx)" className="input-line w-full mb-4 py-2" defaultValue="25000" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input placeholder="Interval amount" className="input-line py-2" defaultValue="5000" />
            <input placeholder="Check-in window (blocks)" className="input-line py-2" defaultValue="144" />
          </div>

          <button onClick={createPayroll} disabled={loading} className="btn-primary w-full">CREATE &amp; FUND PAYROLL VAULT</button>
        </div>

        <div className="mt-8 text-xs">Progress and check-in logs live in detail view. Uses same escrow + FlowVault lock.</div>
      </main>
    </div>
  );
}
