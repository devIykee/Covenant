"use client";

import { useState, useEffect } from "react";
import { Nav } from "@/src/components/Nav";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getCurrentBlockHeight } from "@/src/lib/flowvault";
import { toMicro } from "@/src/lib/units";
import { GuidedTour, type TourStep } from "@/src/components/GuidedTour";

const CREATE_TOUR: TourStep[] = [
  { selector: "#tour-title", title: "Name your covenant", body: "A clear title investors will recognize — e.g. \"Q3 Protocol Development\"." },
  { selector: "#tour-milestone", title: "Describe the deliverable", body: "This is the promise funds are gated on. Be specific about what will be delivered." },
  { selector: "#tour-details", title: "Acceptance criteria", body: "Spell out exactly what the judges will check before releasing funds." },
  { selector: "#tour-goal", title: "Funding goal", body: "How much USDCx you aim to raise. Investors send this token to the escrow custodian." },
  { selector: "#tour-deadline", title: "Deadline", body: "Pick a calendar date. We convert it to a Stacks block height for the on-chain time-lock." },
  { selector: "#tour-min", title: "Minimum to proceed", body: "The least you'll accept. Raise below it and investors can withdraw — or you can accept the partial amount. 100% = all-or-nothing." },
  { selector: "#tour-builder", title: "Builder address (optional)", body: "The builder's Stacks address. Leave blank to use your connected wallet." },
  { selector: "#tour-treasury", title: "Treasury address", body: "Where the 80% builder payout is sent if the milestone succeeds." },
  { selector: "#tour-submit", title: "Publish the campaign", body: "Creates the campaign and lists it on the site. Investors deposit into escrow and then appoint the judges — you don't pick your own referees." },
];

export default function CreateProject() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [estimatedBlock, setEstimatedBlock] = useState<number | null>(null);
  const [connectedAddr, setConnectedAddr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setConnectedAddr(localStorage.getItem("covenant-address"));
  }, []);

  const [form, setForm] = useState({
    title: "",
    description: "",
    fundingGoal: "",
    milestoneDescription: "",
    deadlineDate: "",
    builderAddress: "",
    treasuryAddress: "",
    minPct: "100",
  });

  // Estimate block height from the full date+time (testnet ~ 144 blocks/hour).
  const BLOCKS_PER_HOUR = 144;
  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // datetime-local, e.g. "2026-07-15T18:00"
    setForm({ ...form, deadlineDate: val });

    if (val) {
      try {
        const current = await getCurrentBlockHeight();
        const target = new Date(val).getTime();
        const now = Date.now();
        const hours = Math.max(1, (target - now) / (1000 * 60 * 60));
        const est = Math.floor(current + hours * BLOCKS_PER_HOUR);
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

      // The builder IS the connected wallet (or an address they explicitly typed).
      // Without this, the campaign wouldn't show up on their dashboard.
      const builder = (form.builderAddress || connectedAddr || "").trim();
      if (!/^S[TP][0-9A-Z]{38,40}$/.test(builder)) {
        throw new Error("Connect your wallet (or enter your Stacks address) so this campaign is linked to you.");
      }

      const goalMicro = toMicro(form.fundingGoal);

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
          deadlineAt: new Date(form.deadlineDate).toISOString(),
          builderAddress: builder,
          treasuryAddress: (form.treasuryAddress || builder).trim(),
          minFundingBps: Math.round(Math.min(100, Math.max(1, Number(form.minPct) || 100)) * 100),
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
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">EXECUTION DEADLINE (DATE &amp; TIME)</label>
                <input
                  id="tour-deadline"
                  type="datetime-local"
                  value={form.deadlineDate}
                  onChange={handleDateChange}
                  className="input-line w-full px-4 py-3 font-data-lg text-lg"
                  required
                />
                <p className="mt-1.5 font-data-sm text-xs text-[var(--on-surface-variant)]">
                  {form.deadlineDate ? <>Deadline: <span className="font-bold text-[var(--ink)]">{new Date(form.deadlineDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span> · </> : null}
                  approx. block <span className="font-bold text-[var(--ink)]">{estimatedBlock ?? "—"}</span>
                </p>
              </div>
            </div>

            <div className="mt-6" id="tour-min">
              <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">MINIMUM TO PROCEED (% OF GOAL)</label>
              <div className="relative max-w-[200px]">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.minPct}
                  onChange={(e) => setForm({ ...form, minPct: e.target.value })}
                  className="input-line w-full pl-4 pr-10 py-3 font-data-lg text-lg"
                />
                <div className="absolute right-4 top-3 text-sm text-[var(--on-surface-variant)]">%</div>
              </div>
              <p className="mt-1.5 text-xs text-[var(--on-surface-variant)] max-w-lg">
                If less than this is raised, investors can withdraw their deposits — or you can accept the partial amount and proceed. 100% means all-or-nothing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">BUILDER PRINCIPAL (YOUR WALLET)</label>
                <input
                  id="tour-builder"
                  value={form.builderAddress}
                  onChange={(e) => setForm({ ...form, builderAddress: e.target.value })}
                  className="input-line w-full px-4 py-3 font-data-sm"
                  placeholder={connectedAddr || "ST... (connect your wallet)"}
                />
                <p className="mt-1 text-[11px] text-[var(--on-surface-variant)]">{connectedAddr ? "Defaults to your connected wallet — leave blank to use it." : "Connect your wallet so this campaign appears on your dashboard."}</p>
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

          <div className="rounded-sm border border-[var(--ink)]/15 bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
            <span className="font-label-caps text-[10px] text-[var(--ink)]">HOW JUDGING WORKS</span>
            <p className="mt-1">You don&rsquo;t pick the judges — that would let you approve your own work. After investors deposit into escrow, <strong className="text-[var(--ink)]">they</strong> appoint the judges who verify your milestone. Funds release only when the appointed judges attest.</p>
          </div>

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
