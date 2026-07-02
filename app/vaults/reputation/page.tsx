import { Nav } from "@/src/components/Nav";
import Link from "next/link";
import { db } from "@/src/lib/db";
import { ReputationManager } from "@/src/components/ReputationManager";

export const dynamic = "force-dynamic";

export default async function ReputationVault() {
  const leaders = await db.reputation
    .findMany({ orderBy: { score: "desc" }, take: 50 })
    .catch(() => [] as { principal: string; score: number }[]);
  const scores: Record<string, number> = Object.fromEntries(leaders.map((r) => [r.principal, r.score]));

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-grow max-w-[1200px] mx-auto w-full px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display-lg text-3xl">Reputation-Weighted Vault</h1>
          <span className="text-[10px] font-label-caps px-2 py-0.5 rounded bg-[#2f7d5b]/20 text-[#2f7d5b]">LIVE</span>
        </div>
        <p className="text-sm text-[var(--on-surface-variant)] max-w-2xl">
          Reputation is earned automatically: <strong className="text-[var(--ink)]">+1 for every covenant that resolves successfully</strong> while
          you were a builder or backer (written on resolution of the live Milestone vault). In a reputation vault, payout
          splits are computed from these scores. The leaderboard below is <strong className="text-[var(--ink)]">live from the database</strong>.
        </p>

        <div className="mt-8 card-container p-0 overflow-hidden max-w-2xl">
          <div className="p-4 border-b border-[var(--ink)]/10 font-label-caps text-xs text-[var(--on-surface-variant)]">
            REPUTATION LEADERBOARD
          </div>
          {leaders.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--on-surface-variant)]">
              No reputation yet. Resolve a covenant successfully to start earning it.
            </div>
          ) : (
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-[var(--ink)]/10 bg-[var(--surface-container-low)]/40">
                  <th className="p-3 text-xs text-left">#</th>
                  <th className="p-3 text-xs text-left">PRINCIPAL</th>
                  <th className="p-3 text-xs text-right">SCORE</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((r, i) => (
                  <tr key={r.principal} className="border-b border-[var(--ink)]/10">
                    <td className="p-3 text-sm text-[var(--on-surface-variant)]">{i + 1}</td>
                    <td className="p-3 font-data-sm text-xs text-[var(--ink)] break-all">{r.principal}</td>
                    <td className="p-3 text-right font-data-sm text-[var(--ink)]">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <ReputationManager scores={scores} />

        <div className="mt-10 text-xs text-[var(--on-surface-variant)] max-w-2xl">
          Splits are computed automatically from the reputation above and paid out with real SIP-010 transfers from the
          escrow custodian. Reputation is minted by resolving <Link href="/projects" className="underline text-[var(--ink)] hover:no-underline">Milestone covenants</Link>.
        </div>
      </main>
    </div>
  );
}
