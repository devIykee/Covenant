"use client";

import { useState } from "react";
import { Nav } from "@/src/components/Nav";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getCurrentBlockHeight } from "@/src/lib/flowvault";
import { GuidedTour, type TourStep } from "@/src/components/GuidedTour";

const CREATE_TOUR: TourStep[] = [
  { selector: "#tour-title", title: "Name your covenant", body: "A clear title investors will recognize — e.g. \"Q3 Protocol Development\"." },
  { selector: "#tour-milestone", title: "Describe the deliverable", body: "This is the promise funds are gated on. Be specific about what will be delivered." },
  { selector: "#tour-details", title: "Acceptance criteria", body: "Spell out exactly what the judges will check before releasing funds." },
  { selector: "#tour-goal", title: "Funding goal", body: "How much USDCx you aim to raise. Investors send this token to the escrow custodian." },
  { selector: "#tour-deadline", title: "Deadline", body: "Pick a calendar date. We convert it to a Stacks block height for the on-chain time-lock." },
  { selector: "#tour-builder", title: "Builder address (optional)", body: "The builder's Stacks address. Leave blank to use your connected wallet." },
  { selector: "#tour-treasury", title: "Treasury address", body: "Where the 80% builder payout is sent if the milestone succeeds." },
  { selector: "#tour-judges", title: "Invite independent judges", body: "This is the trust anchor: invite 2–3 independent people to verify the milestone. Funds only release when 2 of them agree — so investors don't have to trust you alone." },
  { selector: "#tour-submit", title: "Initialize the covenant", body: "Creates the on-ledger record. Next you'll share the custodian address for investors to fund it." },
];

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
  const [judges, setJudges] = useState<string[]>(["", "", ""]);

  const setJudge = (i: number, val: string) => {
    setJudges((prev) => prev.map((j, idx) => (idx === i ? val.trim() : j)));
  };

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

      const cleanJudges = judges.map((j) => j.trim()).filter(Boolean);
      const badJudge = cleanJudges.find((j) => !/^S[TP][0-9A-Z]{38,40}$/.test(j));
      if (badJudge) throw new Error(`"${badJudge.slice(0, 12)}…" is not a valid Stacks address`);
      if (cleanJudges.length < 2) throw new Error("Invite at least 2 judges — investors trust independent verifiers, not you alone.");
      if (form.builderAddress && cleanJudges.includes(form.builderAddress.trim())) {
        throw new Error("A judge should be independent — don't list your own builder address as a judge.");
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
          judges: cleanJudges,
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
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display-lg-mobile md:font-display-lg text-3xl md:text-[32px] mb-2">Initialize Agreement</h1>
          </div>
          <p className="text-[var(--on-surface-variant)] font-body-lg border-b border-[var(--ink)]/20 pb-6">
            Draft a new notarized covenant. Ensure all terms are precisely defined before execution.
            <span className="block mt-2 text-sm">First time? A short guided tour will point out what each field does — no need to read the docs.</span>
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
                  id="tour-title"
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
                  id="tour-milestone"
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
                  id="tour-details"
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
                    id="tour-goal"
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
                  id="tour-deadline"
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
                  id="tour-builder"
                  value={form.builderAddress}
                  onChange={(e) => setForm({ ...form, builderAddress: e.target.value })}
                  className="input-line w-full px-4 py-3 font-data-sm"
                  placeholder="ST... (your address)"
                />
              </div>
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">TREASURY ADDRESS</label>
                <input
                  id="tour-treasury"
                  value={form.treasuryAddress}
                  onChange={(e) => setForm({ ...form, treasuryAddress: e.target.value })}
                  className="input-line w-full px-4 py-3 font-data-sm"
                  placeholder="ST... (receive address)"
                />
              </div>
            </div>
          </section>

          {/* Independent Verifiers (Judges) */}
          <section id="tour-judges" className="card-container p-8 relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-6xl">⚖︎</div>
            <h2 className="font-headline-md mb-2 flex items-center gap-2">
              <span className="stamp-open rounded-full w-7 h-7 flex items-center justify-center text-[10px] mr-2">III</span>
              INDEPENDENT VERIFIERS
            </h2>
            <p className="text-sm text-[var(--on-surface-variant)] mb-6 max-w-xl">
              Invite trusted third parties to attest whether the milestone was met. This is what lets investors
              fund you <strong className="text-[var(--ink)]">without fearing you&rsquo;ll run away</strong> — funds only release
              when <strong className="text-[var(--ink)]">2 of your judges</strong> agree. Judges should be independent
              (not your own address). Paste their Stacks addresses; share the covenant link with them to attest.
            </p>

            <div className="space-y-4">
              {judges.map((j, i) => (
                <div key={i}>
                  <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">
                    JUDGE {i + 1}{i < 2 ? " (required)" : " (optional)"}
                  </label>
                  <input
                    value={j}
                    onChange={(e) => setJudge(i, e.target.value)}
                    className="input-line w-full px-4 py-3 font-data-sm"
                    placeholder="ST... (a judge's Stacks address)"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[var(--on-surface-variant)] mt-3">Invite at least 2. A 2-of-N majority is required to release funds.</p>
          </section>

          <div className="pt-6 border-t border-[var(--ink)]/20 flex flex-col items-center text-center">
            <p className="text-sm text-[var(--on-surface-variant)] max-w-md mb-6">
              By initializing this covenant, you agree to secure the stated funds in escrow until the defined milestones are cryptographically verified.
            </p>

            <button id="tour-submit" type="submit" disabled={loading} className="btn-primary w-full md:w-auto px-12 disabled:opacity-50">
              {loading ? "INITIALIZING ON LEDGER..." : "INITIALIZE COVENANT"}
            </button>
            <button type="button" onClick={() => router.back()} className="mt-4 text-xs text-[var(--on-surface-variant)] underline">CANCEL DRAFT</button>
          </div>
        </form>
      </main>

      <GuidedTour steps={CREATE_TOUR} storageKey="covenant-create-tour-v1" />
    </div>
  );
}
