"use client";

import { useState, useEffect } from "react";
import { Nav } from "@/src/components/Nav";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getCurrentBlockHeight } from "@/src/lib/flowvault";
import { toMicro } from "@/src/lib/units";
import { GuidedTour, type TourStep } from "@/src/components/GuidedTour";

const CREATE_TOUR: TourStep[] = [
  { selector: "#tour-title", title: "Name your program", body: "A clear title builders will recognize — e.g. \"Artemis Protocol Developer Grant\"." },
  { selector: "#tour-desc", title: "Describe the program", body: "What is this grant for? What should the awarded builder deliver overall?" },
  { selector: "#tour-conditions", title: "Eligibility conditions", body: "Who can apply and what you expect — used by builders to decide whether to pitch." },
  { selector: "#tour-pool", title: "Pool size", body: "The full amount you'll award. You must lock 100% of this in escrow before the program is publicly listed." },
  { selector: "#tour-deadline", title: "Program horizon (date & time)", body: "The outer deadline by which all milestones must resolve. Converted to a Stacks block height for the on-chain time-locks." },
  { selector: "#tour-submit", title: "Create the program", body: "Creates a DRAFT program and takes you to fund it. Nothing is public until the pool is locked in escrow." },
];

export default function CreateProgram() {
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
    conditions: "",
    pool: "",
    deadlineDate: "",
  });

  const BLOCKS_PER_HOUR = 144;
  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm({ ...form, deadlineDate: val });
    if (val) {
      try {
        const current = await getCurrentBlockHeight();
        const target = new Date(val).getTime();
        const hours = Math.max(1, (target - Date.now()) / (1000 * 60 * 60));
        setEstimatedBlock(Math.floor(current + hours * BLOCKS_PER_HOUR));
      } catch {
        setEstimatedBlock(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!form.title || !form.description || !form.pool || !form.deadlineDate) {
        throw new Error("Title, description, pool, and horizon are required.");
      }
      const grantor = (connectedAddr || "").trim();
      if (!/^S[TP][0-9A-Z]{38,40}$/.test(grantor)) {
        throw new Error("Connect your wallet so this program is linked to you as the grantor.");
      }

      const currentBlock = await getCurrentBlockHeight();
      const targetBlock = estimatedBlock || currentBlock + 5000;

      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          conditions: form.conditions,
          grantorAddress: grantor,
          totalPool: toMicro(form.pool),
          programDeadlineBlock: targetBlock,
          programDeadlineAt: new Date(form.deadlineDate).toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create program");
      }
      const program = await res.json();
      toast.success("Program created. Next: fund the escrow to publish it.");
      router.push(`/projects/${program.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create program");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-grow w-full max-w-3xl mx-auto px-6 md:px-12 py-12">
        <div className="mb-12">
          <h1 className="font-display-lg-mobile md:font-display-lg text-3xl md:text-[32px] mb-2">Create a Grant Program</h1>
          <p className="text-[var(--on-surface-variant)] font-body-lg border-b border-[var(--ink)]/20 pb-6">
            You are the <strong className="text-[var(--ink)]">grantor</strong>. Define the pool and conditions now; you&rsquo;ll lock the funds in escrow on the next screen, then builders apply.
            <span className="block mt-2 text-sm">First time? A short guided tour points out what each field does.</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          <section className="card-container p-8 relative">
            <h2 className="font-headline-md mb-6 flex items-center gap-2">
              <span className="stamp-open rounded-full w-7 h-7 flex items-center justify-center text-[10px] mr-2">I</span>
              PROGRAM
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">PROGRAM TITLE</label>
                <input id="tour-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input-line w-full px-4 py-3 font-data-lg text-lg placeholder:text-[var(--on-surface-variant)]/50"
                  placeholder="e.g. Artemis Protocol Developer Grant" required />
              </div>
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">DESCRIPTION</label>
                <textarea id="tour-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-line w-full px-4 py-3 font-body-md placeholder:text-[var(--on-surface-variant)]/50 resize-y min-h-[96px]"
                  placeholder="What this grant funds and what the awarded builder should deliver overall..." required />
              </div>
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">ELIGIBILITY CONDITIONS</label>
                <textarea id="tour-conditions" value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })}
                  className="input-line w-full px-4 py-3 font-body-md placeholder:text-[var(--on-surface-variant)]/50 resize-y" rows={3}
                  placeholder="Who can apply, prerequisites, expectations (open-source, prior testnet work, etc.)" />
              </div>
            </div>
          </section>

          <section className="card-container p-8 relative">
            <h2 className="font-headline-md mb-6 flex items-center gap-2">
              <span className="stamp-open rounded-full w-7 h-7 flex items-center justify-center text-[10px] mr-2">II</span>
              POOL &amp; HORIZON
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">TOTAL POOL (USDCx)</label>
                <div className="relative">
                  <input id="tour-pool" type="number" step="0.01" value={form.pool} onChange={(e) => setForm({ ...form, pool: e.target.value })}
                    className="input-line w-full pl-4 pr-16 py-3 font-data-lg text-lg" placeholder="250000.00" required />
                  <div className="absolute right-4 top-3 text-xs text-[var(--on-surface-variant)] font-label-caps">USDCx</div>
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--on-surface-variant)]">You&rsquo;ll lock 100% of this in escrow before the program goes public.</p>
              </div>
              <div>
                <label className="block font-label-caps text-xs text-[var(--on-surface-variant)] mb-2">PROGRAM HORIZON (DATE &amp; TIME)</label>
                <input id="tour-deadline" type="datetime-local" value={form.deadlineDate} onChange={handleDateChange}
                  className="input-line w-full px-4 py-3 font-data-lg text-lg" required />
                <p className="mt-1.5 font-data-sm text-xs text-[var(--on-surface-variant)]">
                  {form.deadlineDate ? <>Horizon: <span className="font-bold text-[var(--ink)]">{new Date(form.deadlineDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span> · </> : null}
                  approx. block <span className="font-bold text-[var(--ink)]">{estimatedBlock ?? "—"}</span>
                </p>
              </div>
            </div>
          </section>

          <div className="rounded-sm border border-[var(--ink)]/15 bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
            <span className="font-label-caps text-[10px] text-[var(--ink)]">WHAT HAPPENS NEXT</span>
            <p className="mt-1">After you create the program you&rsquo;ll send the full pool to its dedicated escrow custodian. Once the funds are verified on-chain, the program is published and builders can apply. You accept one builder and set their milestone schedule — each milestone auto-pays when judges attest it.</p>
          </div>

          <div className="pt-6 border-t border-[var(--ink)]/20 flex flex-col items-center text-center">
            <button id="tour-submit" type="submit" disabled={loading} className="btn-primary w-full md:w-auto px-12 disabled:opacity-50">
              {loading ? "CREATING PROGRAM..." : "CREATE PROGRAM"}
            </button>
            <button type="button" onClick={() => router.back()} className="mt-4 text-xs text-[var(--on-surface-variant)] underline">CANCEL</button>
          </div>
        </form>
      </main>

      <GuidedTour steps={CREATE_TOUR} storageKey="covenant-create-program-tour-v1" />
    </div>
  );
}
