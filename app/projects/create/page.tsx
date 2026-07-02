"use client";

import { useState } from "react";
import { Nav } from "@/src/components/Nav";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getCurrentBlockHeight } from "@/src/lib/flowvault";

export default function CreateProject() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [estimatedBlock, setEstimatedBlock] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    fundingGoal: "",
    milestoneDescription: "",
    deadlineDate: "",
    builderAddress: "",
    treasuryAddress: "",
  });

  // Estimate block height from date (testnet ~ 144 blocks/hour ~ 3456/day)
  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm({ ...form, deadlineDate: val });

    if (val) {
      try {
        const current = await getCurrentBlockHeight();
        const target = new Date(val).getTime();
        const now = Date.now();
        const days = Math.max(1, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
        const est = Math.floor(current + days * 3456); // rough blocks per day on testnet
        setEstimatedBlock(est);
      } catch {
        setEstimatedBlock(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!form.title || !form.description || !form.fundingGoal || !form.milestoneDescription || !form.deadlineDate) {
        throw new Error("All fields are required");
      }

      // Convert goal to micro (assume USDCx has 6 decimals)
      const goalMicro = (parseFloat(form.fundingGoal) * 1_000_000).toString();

      const currentBlock = await getCurrentBlockHeight();
      const targetBlock = estimatedBlock || (currentBlock + 5000);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          fundingGoal: goalMicro,
          milestoneDescription: form.milestoneDescription,
          deadlineBlock: targetBlock,
          builderAddress: form.builderAddress || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", // fallback demo
          treasuryAddress: form.treasuryAddress || form.builderAddress || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create project");
      }

      const project = await res.json();
      toast.success("Covenant initialized. Redirecting...");
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create covenant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-grow w-full max-w-3xl mx-auto px-6 md:px-12 py-12">
        <div className="mb-12">
          <h1 className="font-display-lg-mobile md:font-display-lg text-3xl md:text-[32px] mb-2">Initialize Agreement</h1>
          <p className="text-[var(--on-surface-variant)] font-body-lg border-b border-[var(--ink)]/20 pb-6">
            Draft a new notarized covenant. Ensure all terms are precisely defined before execution.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Primary Directive */}
          <section className="card-container p-8 relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-6xl">⚖︎</div>
            <h2 className="font-headline-md mb-6 flex items-center gap-2">
              <span className="stamp-open rounded-full w-7 h-7 flex items-center justify-center text-[10px] mr-2">I</span>
              PRIMARY DIRECTIVE
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">COVENANT TITLE</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input-line w-full px-4 py-3 font-data-lg text-lg placeholder:text-[var(--on-surface-variant)]/50"
                  placeholder="e.g. Q3 Protocol Development"
                  required
                />
              </div>
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">MILESTONE DESCRIPTION</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-line w-full px-4 py-3 font-body-md placeholder:text-[var(--on-surface-variant)]/50 resize-y min-h-[96px]"
                  placeholder="Provide a detailed account of the deliverables..."
                  required
                />
              </div>
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">MILESTONE DETAILS</label>
                <textarea
                  value={form.milestoneDescription}
                  onChange={(e) => setForm({ ...form, milestoneDescription: e.target.value })}
                  className="input-line w-full px-4 py-3 font-body-md placeholder:text-[var(--on-surface-variant)]/50 resize-y"
                  rows={3}
                  placeholder="Detailed acceptance criteria for milestone attestation..."
                  required
                />
              </div>
            </div>
          </section>

          {/* Financial Stipulations */}
          <section className="card-container p-8 relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-6xl">💰</div>
            <h2 className="font-headline-md mb-6 flex items-center gap-2">
              <span className="stamp-open rounded-full w-7 h-7 flex items-center justify-center text-[10px] mr-2">II</span>
              FINANCIAL STIPULATIONS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">FUNDING GOAL (USDCx)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={form.fundingGoal}
                    onChange={(e) => setForm({ ...form, fundingGoal: e.target.value })}
                    className="input-line w-full pl-4 pr-16 py-3 font-data-lg text-lg"
                    placeholder="250000.00"
                    required
                  />
                  <div className="absolute right-4 top-3 text-xs text-[var(--on-surface-variant)] font-label-caps">USDCx</div>
                </div>
              </div>

              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">EXECUTION DEADLINE</label>
                <input
                  type="date"
                  value={form.deadlineDate}
                  onChange={handleDateChange}
                  className="input-line w-full px-4 py-3 font-data-lg text-lg"
                  required
                />
                <p className="mt-1.5 font-data-sm text-xs text-[var(--on-surface-variant)]">
                  Estimated Block Height: <span className="font-bold text-[var(--ink)]">{estimatedBlock ?? "—"}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">BUILDER PRINCIPAL (OPTIONAL)</label>
                <input
                  value={form.builderAddress}
                  onChange={(e) => setForm({ ...form, builderAddress: e.target.value })}
                  className="input-line w-full px-4 py-3 font-data-sm"
                  placeholder="ST... (your address)"
                />
              </div>
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">TREASURY ADDRESS</label>
                <input
                  value={form.treasuryAddress}
                  onChange={(e) => setForm({ ...form, treasuryAddress: e.target.value })}
                  className="input-line w-full px-4 py-3 font-data-sm"
                  placeholder="ST... (receive address)"
                />
              </div>
            </div>
          </section>

          <div className="pt-6 border-t border-[var(--ink)]/20 flex flex-col items-center text-center">
            <p className="text-sm text-[var(--on-surface-variant)] max-w-md mb-6">
              By initializing this covenant, you agree to secure the stated funds in escrow until the defined milestones are cryptographically verified.
            </p>

            <button type="submit" disabled={loading} className="btn-primary w-full md:w-auto px-12 disabled:opacity-50">
              {loading ? "INITIALIZING ON LEDGER..." : "INITIALIZE COVENANT"}
            </button>
            <button type="button" onClick={() => router.back()} className="mt-4 text-xs text-[var(--on-surface-variant)] underline">CANCEL DRAFT</button>
          </div>
        </form>
      </main>
    </div>
  );
}
