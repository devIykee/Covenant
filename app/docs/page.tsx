import { Nav } from "@/src/components/Nav";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs | Covenant",
  description:
    "A total-beginner guide to Covenant: what it is, how the FlowVault escrow custodian pattern works, and how to create, fund, and resolve a conditional treasury on Stacks testnet.",
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-8 h-8 rounded-full border-2 border-[var(--ink)] flex items-center justify-center font-data-sm text-sm font-bold">
        {n}
      </div>
      <div className="flex-1 pb-2">
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-sm text-[var(--on-surface-variant)] space-y-2">{children}</div>
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="font-data-sm text-[12px] bg-[var(--surface-container-low)] border border-[var(--ink)]/10 rounded-sm p-4 overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav showMyCovenants={false} />

      <main className="flex-grow w-full max-w-[820px] mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">DOCUMENTATION</div>
          <h1 className="font-display-lg text-[36px] leading-tight tracking-[-0.02em] mb-4">
            Covenant, from zero.
          </h1>
          <p className="font-body-lg text-[var(--on-surface-variant)]">
            Never touched Stacks, a crypto wallet, or a smart contract before? Perfect. This page walks
            you from a blank machine to a real, auditable conditional-treasury transaction on the Stacks
            testnet — every click explained.
          </p>

          <div className="mt-6 card-container p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">LIVE APP</div>
              <a href="https://thecovenant.vercel.app" target="_blank" rel="noreferrer" className="font-data-sm text-[var(--ink)] underline hover:no-underline break-all">
                thecovenant.vercel.app
              </a>
            </div>
            <a href="https://thecovenant.vercel.app" target="_blank" rel="noreferrer" className="btn-primary text-center shrink-0">
              OPEN THE LIVE APP ↗
            </a>
          </div>
        </header>

        {/* Table of contents */}
        <nav className="mb-14 card-container p-6">
          <div className="font-label-caps text-xs text-[var(--on-surface-variant)] mb-3">ON THIS PAGE</div>
          <ol className="grid sm:grid-cols-2 gap-2 text-sm">
            <li><a href="#what" className="underline hover:no-underline">1. What is Covenant?</a></li>
            <li><a href="#flowvault" className="underline hover:no-underline">2. What is FlowVault?</a></li>
            <li><a href="#custodian" className="underline hover:no-underline">3. The escrow custodian pattern</a></li>
            <li><a href="#setup" className="underline hover:no-underline">4. One-time setup (10 min)</a></li>
            <li><a href="#walkthrough" className="underline hover:no-underline">5. Full walkthrough</a></li>
            <li><a href="#vaulttypes" className="underline hover:no-underline">6. The four vault types</a></li>
            <li><a href="#troubleshoot" className="underline hover:no-underline">7. Troubleshooting</a></li>
          </ol>
        </nav>

        <div className="space-y-16">
          {/* 1. What is Covenant */}
          <section id="what" className="scroll-mt-24">
            <h2 className="font-headline-md text-2xl mb-3">1. What is Covenant?</h2>
            <div className="space-y-3 text-[var(--on-surface-variant)]">
              <p>
                Covenant is a <strong className="text-[var(--ink)]">conditional treasury platform</strong>.
                Money is deposited into a shared vault and only moves when a real-world condition is
                verifiably met — a milestone being delivered, a payroll check-in happening, an insurance
                incident being declared.
              </p>
              <p>
                Think of it as programmable escrow. Instead of trusting one person to hold funds and
                &ldquo;do the right thing,&rdquo; the rules for how money is locked, split, and released are
                enforced on-chain and recorded on a public ledger anyone can audit.
              </p>
            </div>
          </section>

          {/* 2. What is FlowVault */}
          <section id="flowvault" className="scroll-mt-24">
            <h2 className="font-headline-md text-2xl mb-3">2. What is FlowVault?</h2>
            <div className="space-y-3 text-[var(--on-surface-variant)]">
              <p>
                <a href="https://docs.flow-vault.dev" target="_blank" rel="noreferrer" className="underline text-[var(--ink)] hover:no-underline">FlowVault</a>{" "}
                is a programmable asset-routing layer on Stacks. It provides a single contract
                (<code className="font-data-sm">flowvault-v2</code>) with <strong className="text-[var(--ink)]">per-wallet routing rules</strong>. When
                you deposit tokens, FlowVault can automatically:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-[var(--ink)]">Lock</strong> an amount until a future block height (a time-lock).</li>
                <li><strong className="text-[var(--ink)]">Split</strong> an amount to another address on deposit (auto-routing).</li>
                <li><strong className="text-[var(--ink)]">Hold</strong> the remainder as your withdrawable balance.</li>
              </ul>
              <p>
                Covenant uses these primitives — <code className="font-data-sm">set-routing-rules</code>,{" "}
                <code className="font-data-sm">deposit</code>, <code className="font-data-sm">withdraw</code> — as the
                on-chain engine underneath every vault type.
              </p>
            </div>
          </section>

          {/* 3. Custodian pattern */}
          <section id="custodian" className="scroll-mt-24">
            <h2 className="font-headline-md text-2xl mb-3">3. The escrow custodian pattern (read this)</h2>
            <div className="space-y-3 text-[var(--on-surface-variant)]">
              <p>
                Here&rsquo;s the honest, important design detail. FlowVault&rsquo;s routing rules are fixed{" "}
                <em>at the moment of deposit</em>, and <code className="font-data-sm">withdraw</code> always
                pays the depositor back. So the contract <strong className="text-[var(--ink)]">cannot natively branch</strong>{" "}
                &ldquo;if the milestone succeeds send here, otherwise refund there.&rdquo;
              </p>
              <p>Covenant solves this at the application layer with an escrow custodian:</p>
              <div className="card-container p-5 space-y-3">
                <Step n={1} title="Investors send USDCx to a known custodian address">
                  A backend-controlled testnet account. Each contribution is tracked in our database against
                  the investor&rsquo;s wallet and the project.
                </Step>
                <Step n={2} title="The custodian pools funds into its own FlowVault vault">
                  It calls <code className="font-data-sm">set-routing-rules</code> + <code className="font-data-sm">deposit</code>,
                  locking 100% until the deadline block. This is the real on-chain programmable behavior.
                </Step>
                <Step n={3} title="Investors appoint judges, who attest (2-of-N multisig)">
                  The builder <strong className="text-[var(--ink)]">cannot pick the judges</strong> — that would be judging their own work.
                  After investors deposit, <strong className="text-[var(--ink)]">they</strong> appoint the judges (an investor may appoint themselves).
                  Each judge connects their wallet and <strong className="text-[var(--ink)]">cryptographically signs</strong> their &ldquo;met&rdquo; / &ldquo;not met&rdquo;
                  vote; the server verifies the signature against their address. Once 2-of-N sign MET, a dispute window opens before funds move.
                </Step>
                <Step n={4} title="The custodian withdraws and distributes">
                  After the lock passes, it calls <code className="font-data-sm">withdraw</code> and sends tracked
                  SIP-010 transfers: on success 80% to the builder + 20% pro-rata to investors; on failure, 100%
                  refunded pro-rata.
                </Step>
              </div>
              <p>
                Every one of those steps produces a real transaction id with a clickable{" "}
                <a href="https://explorer.hiro.so/?chain=testnet" target="_blank" rel="noreferrer" className="underline text-[var(--ink)] hover:no-underline">Stacks explorer</a>{" "}
                link, so the whole lifecycle is auditable.
              </p>
            </div>
          </section>

          {/* 4. Setup */}
          <section id="setup" className="scroll-mt-24">
            <h2 className="font-headline-md text-2xl mb-3">4. One-time setup (about 10 minutes)</h2>
            <div className="space-y-4 text-[var(--on-surface-variant)]">
              <div className="card-container p-5 space-y-4">
                <Step n={1} title="Install a Stacks wallet">
                  <a href="https://www.xverse.app" target="_blank" rel="noreferrer" className="underline text-[var(--ink)] hover:no-underline">Xverse</a>{" "}
                  (easiest) or <a href="https://leather.io" target="_blank" rel="noreferrer" className="underline text-[var(--ink)] hover:no-underline">Leather</a>.
                  Create an account and switch it to <strong className="text-[var(--ink)]">Testnet</strong>. Your
                  address starts with <code className="font-data-sm">ST…</code>.
                </Step>
                <Step n={2} title="Get free testnet STX (for gas)">
                  Open the{" "}
                  <a href="https://explorer.hiro.so/sandbox/faucet?chain=testnet" target="_blank" rel="noreferrer" className="underline text-[var(--ink)] hover:no-underline">Hiro testnet faucet</a>,
                  paste your <code className="font-data-sm">ST…</code> address, and request STX. This is play money — it has no real value.
                </Step>
                <Step n={3} title="Get testnet USDCx (the token Covenant uses)">
                  Use the FlowVault bounty&rsquo;s &ldquo;Need Testnet USDCx?&rdquo; dispenser, or ask in the Stacks/FlowVault
                  community channel. Send some to your <code className="font-data-sm">ST…</code> address.
                </Step>
                <Step n={4} title="Just want to try it? Use the live app">
                  You don&rsquo;t have to run anything locally — the deployed app is at{" "}
                  <a href="https://thecovenant.vercel.app" target="_blank" rel="noreferrer" className="underline text-[var(--ink)] hover:no-underline">thecovenant.vercel.app</a>.
                  Connect a testnet wallet and go straight to the <a href="#walkthrough" className="underline hover:no-underline">walkthrough</a>.
                </Step>
                <Step n={5} title="Or run it locally (for developers)">
                  You need Node.js 18+. Then:
                  <Code>{`git clone <your-repo-url>
cd covenant
npm install
cp .env.example .env       # then edit values (see below)
npm run db:push            # local SQLite; for Vercel use Turso (step 7)
npm run dev`}</Code>
                  Open <a href="http://localhost:3000" className="underline text-[var(--ink)] hover:no-underline">http://localhost:3000</a>.
                </Step>
                <Step n={6} title="Configure the custodian key (server-side only)">
                  In <code className="font-data-sm">.env</code>, set <code className="font-data-sm">STACKS_PRIVATE_KEY</code> to the
                  private key of a <em>separate</em> funded testnet account — this is the escrow custodian. It is
                  read only on the server and never shipped to the browser.
                  <Code>{`NEXT_PUBLIC_FLOWVAULT_NETWORK=testnet
NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS=STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD
NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME=flowvault-v2
NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME=usdcx
STACKS_PRIVATE_KEY=your_custodian_private_key_here
DATABASE_URL="file:./dev.db"`}</Code>
                </Step>
                <Step n={7} title="Deploying to Vercel? Add a Turso database">
                  Vercel&rsquo;s filesystem is read-only, so the local SQLite file can&rsquo;t be used in production.
                  Covenant uses <a href="https://turso.tech" target="_blank" rel="noreferrer" className="underline text-[var(--ink)] hover:no-underline">Turso</a> (a hosted,
                  SQLite-compatible database) — no schema changes needed. Create it, load the tables, and set two env vars in Vercel:
                  <Code>{`turso auth signup
turso db create covenant
turso db shell covenant < schema.sql   # creates all tables

# In Vercel -> Settings -> Environment Variables:
TURSO_DATABASE_URL   (turso db show covenant --url)
TURSO_AUTH_TOKEN     (turso db tokens create covenant)
STACKS_PRIVATE_KEY   (your funded custodian key)`}</Code>
                  When <code className="font-data-sm">TURSO_DATABASE_URL</code> is set it is used automatically; otherwise the app falls back to the local file.
                </Step>
              </div>
              <p className="text-sm">
                No custom smart contract is deployed by you — Covenant consumes the already-deployed{" "}
                <code className="font-data-sm">flowvault-v2</code> contract. The only &ldquo;deployment&rdquo; you do is funding
                the custodian account. See <a href="#custodian" className="underline hover:no-underline">the custodian pattern</a> above.
              </p>
            </div>
          </section>

          {/* 5. Walkthrough */}
          <section id="walkthrough" className="scroll-mt-24">
            <h2 className="font-headline-md text-2xl mb-3">5. Full walkthrough (real transactions)</h2>
            <div className="card-container p-5 space-y-4 text-[var(--on-surface-variant)]">
              <Step n={1} title="Connect your wallet">
                Click <strong className="text-[var(--ink)]">CONNECT WALLET</strong> (top right) and approve. Your address appears truncated with a copy button.
              </Step>
              <Step n={2} title="Create a Covenant">
                Go to <Link href="/projects" className="underline text-[var(--ink)] hover:no-underline">My Covenants</Link> →
                {" "}<Link href="/projects/create" className="underline text-[var(--ink)] hover:no-underline">New Covenant</Link>. Give it a title,
                a milestone description, a funding goal, and a deadline. Submit.
              </Step>
              <Step n={3} title="Back it with USDCx (your first on-chain tx)">
                On the project page, enter an amount in &ldquo;Invest in this Covenant&rdquo; and confirm. Your wallet signs a
                transfer to the custodian. An explorer link appears — that&rsquo;s a real testnet transaction.
              </Step>
              <Step n={4} title="Pool into FlowVault">
                Click <strong className="text-[var(--ink)]">Pool into FlowVault</strong>. The custodian runs{" "}
                <code className="font-data-sm">set-routing-rules</code> + <code className="font-data-sm">deposit</code>, locking 100%.
              </Step>
              <Step n={5} title="Judges attest, dispute window opens">
                Copy the <strong className="text-[var(--ink)]">judge invite link</strong> from the judge panel and send it to your judges.
                Each connects their wallet and signs a vote. Once 2-of-N sign &ldquo;MET,&rdquo; the covenant moves to the dispute window.
              </Step>
              <Step n={6} title="Resolve">
                Choose <strong className="text-[var(--ink)]">Resolve Success</strong> (80/20) or <strong className="text-[var(--ink)]">Resolve Failure</strong>{" "}
                (full refund). The custodian withdraws and distributes. Every transfer is logged with an explorer link.
              </Step>
              <p className="text-sm pt-2">
                That&rsquo;s a complete conditional-treasury cycle on real testnet infrastructure — exactly what a demo video should show.
              </p>
            </div>
          </section>

          {/* 6. Vault types */}
          <section id="vaulttypes" className="scroll-mt-24">
            <h2 className="font-headline-md text-2xl mb-3">6. The four vault types (all live on testnet)</h2>
            <p className="text-sm text-[var(--on-surface-variant)] mb-4">Every type executes real on-chain USDCx transfers through the shared escrow custodian.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Link href="/projects" className="card-container p-5 block hover:opacity-80 transition-opacity">
                <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">MILESTONE · LIVE</div>
                <div className="font-semibold mt-1">Milestone-Gated Vault</div>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">Pooled funding released only when invited judges cryptographically sign that a milestone is met, with a dispute window.</p>
              </Link>
              <Link href="/vaults/payroll" className="card-container p-5 block hover:opacity-80 transition-opacity">
                <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">PAYROLL · LIVE</div>
                <div className="font-semibold mt-1">Streaming Payroll + Clawback</div>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">Each contributor check-in releases a real USDCx payment; a missed check-in claws the remainder back to the payer.</p>
              </Link>
              <Link href="/vaults/reputation" className="card-container p-5 block hover:opacity-80 transition-opacity">
                <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">REPUTATION · LIVE</div>
                <div className="font-semibold mt-1">Reputation-Weighted Split</div>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">Split percentages computed automatically from each participant&rsquo;s reputation, then paid out pro-rata on-chain.</p>
              </Link>
              <Link href="/vaults/insurance" className="card-container p-5 block hover:opacity-80 transition-opacity">
                <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">INSURANCE · LIVE</div>
                <div className="font-semibold mt-1">Parametric Insurance Pool</div>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">Pooled premiums pay the claimant on a declared incident, or refund/roll on expiry — all real transfers.</p>
              </Link>
            </div>
          </section>

          {/* 7. Troubleshooting */}
          <section id="troubleshoot" className="scroll-mt-24">
            <h2 className="font-headline-md text-2xl mb-3">7. Troubleshooting</h2>
            <div className="space-y-2 text-sm text-[var(--on-surface-variant)]">
              <p><strong className="text-[var(--ink)]">&ldquo;STACKS_PRIVATE_KEY is required&rdquo;</strong> — set the key in <code className="font-data-sm">.env</code> and restart <code className="font-data-sm">npm run dev</code>.</p>
              <p><strong className="text-[var(--ink)]">A transaction fails</strong> — the sending wallet (yours or the custodian) is out of USDCx or STX gas. Top up from the faucet.</p>
              <p><strong className="text-[var(--ink)]">My address didn&rsquo;t appear after connecting</strong> — hard refresh (Ctrl/Cmd + Shift + R) and connect again.</p>
              <p><strong className="text-[var(--ink)]">Balance looks stale</strong> — Stacks needs a few seconds to confirm; click Check Balance again after the tx confirms in the explorer.</p>
            </div>
          </section>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 pt-8 border-t border-[var(--ink)]/20 flex flex-col sm:flex-row gap-4">
          <Link href="/projects/create" className="btn-primary text-center">CREATE A COVENANT</Link>
          <a href="https://docs.flow-vault.dev" target="_blank" rel="noreferrer" className="btn-secondary text-center">FLOWVAULT DOCS ↗</a>
        </div>
      </main>
    </div>
  );
}
