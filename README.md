# Covenant

**Covenant** is a conditional treasury platform built for the FlowVault Builder Bounty on Stacks testnet.

**🔗 Live demo: [thecovenant.vercel.app](https://thecovenant.vercel.app)**

Funds only move when real-world conditions are verifiably met.

- **Flagship feature**: the **Milestone-Gated Grant** — backers fund a grant into escrow; it's only **disbursed** to the builder (80%, with 20% returned to backers) when independent judges verify the milestone.
- Uses FlowVault primitives for time-locking pooled capital and deterministic routing.
- Real on-chain testnet transactions via the escrow custodian pattern.
- **Grant framing, not investment**: backers fund a milestone grant; there are no financial returns — the 20% is a pro-rata return of unused pool, not a yield.
- Secondary vault types: Payroll (streaming + clawback), Reputation-weighted, Parametric Insurance.

## FlowVault Integration (Required Deliverable)

**Core Truth (per official docs)**: FlowVault provides one contract (`flowvault-v2`) with **principal-scoped routing rules**.

SDK methods used (via the `flowvault-sdk` `FlowVault` client — see `src/lib/flowvault.ts:createBackendVault` and the calls in `src/lib/escrow.ts`):

| SDK method | Where | Contract fn |
|---|---|---|
| `setRoutingRules(...)` | `src/lib/escrow.ts:58` | `set-routing-rules` |
| `deposit(amount)` | `src/lib/escrow.ts:69` | `deposit` |
| `withdraw(amount)` | `src/lib/escrow.ts:91` | `withdraw` |
| `getVaultState(principal)` | `src/lib/escrow.ts:105` | `get-vault-state` (read) |
| `getRoutingRules(principal)` | `src/lib/escrow.ts:111` | `get-routing-rules` (read) |
| `clearRoutingRules()` | `src/lib/escrow.ts:116` | `clear-routing-rules` |

### Hold / Split / Lock — how the bounty primitives map to real calls

The bounty lists "Lock Vault Flow / Split Vault Flow / Hold Vault Flow." **These are not separate contracts** — FlowVault ships one `flowvault-v2` contract with principal-scoped routing rules. Covenant implements all three as *behavior* on that single contract:

- **Hold behavior** — funds sit in the custodian's vault as unlocked balance (plain `deposit` with no lock), withdrawable at settlement.
- **Lock behavior** — `setRoutingRules(lockAmount, lockUntilBlock, …)` + `deposit` time-locks the pooled grant on-chain until the deadline block; `withdraw` can only pull unlocked balance, always back to the caller.
- **Split behavior** — the routing rule's `splitAddress`/`splitAmount` route part of a deposit to another principal automatically; Covenant also performs the conditional 80/20 grant split at settlement via tracked SIP-010 transfers (the underlying contract can't branch on a future event — see below).

This is orchestrated by the **escrow-custodian pattern** because the primitive is *principal-scoped, not project-scoped* — a single custodian principal holds one vault per covenant lifecycle. The same `src/lib/flowvault.ts` + `src/lib/escrow.ts` wrapper is **reused across all four vault types** (Milestone, Payroll, Reputation, Insurance) — the composability / reusable-integration signal the bounty explicitly rewards.

### Why the Escrow Custodian Pattern

FlowVault routing rules are fixed **at the moment of each deposit** by the depositing principal. There is no native way for the contract to branch destination or amounts based on future events ("did the milestone succeed?").

**Honest architecture**:
1. Users (backers) send SIP-010 (USDCx) to a **known custodian address** (backend-controlled testnet key). These transfers are tracked in our DB against the project.
2. The custodian account pools the funds into **its own FlowVault vault** for the covenant via `setRoutingRules` + `deposit`. This is where the **real programmable behavior** happens on-chain (lock and/or split).
3. At resolution time (after attestations, lock height passed), custodian calls `withdraw()` to unlock.
4. Custodian then executes tracked SIP-010 transfers (via `@stacks/transactions`) to the correct parties based on the application-level outcome:
   - **Milestone met** (2-of-N judges signed MET): grant disbursed — 80% to the builder, 20% returned pro-rata to backers.
   - **Milestone not met**: 100% refunded pro-rata to backers.
   - **Timeout** (deadline passes with no 2-of-N consensus): app-layer safety rule — the grant is cancelled and backers are refunded 100%.

**Other app-layer decisions worth noting:**
- **Minimum-funding threshold**: the builder sets a minimum % of the goal. Below it the covenant can't be locked — backers can **withdraw** their deposit, or the builder can **accept the partial raise** to proceed.
- **Backers control the judges**: the builder cannot pick their own referees. Backers appoint judges after depositing (see below).

All state changes and distributions are logged with txids + direct explorer links.

**Files**:
- `src/lib/flowvault.ts` — typed wrapper + error mapping
- `src/lib/escrow.ts` — reusable custodian actions (pool, withdraw, transfer)
- All features import from these shared modules.

This satisfies bounty emphasis on "depth of use of FlowVault's programmable primitives" and "composability".

## ✅ Live testnet transaction (auditable)

A real, executed FlowVault `set-routing-rules` + `deposit` on Stacks testnet, produced by the app's **Lock Funds in Escrow** action and **surfaced in the running app** (the covenant timeline links straight to the explorer):

- **Tx:** [`d31b9c00…d990d141`](https://explorer.hiro.so/txid/d31b9c0039700accf2158990090207cd78619c1977654aa2193cda9ad990d141?chain=testnet)
- Contract: `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2` · fn `deposit`
- Custodian: `ST27FAPQP4FMKYFRHB1Q0AMT82TNKDF23YA9QKW24`

Open the [live app](https://thecovenant.vercel.app) → the pooled covenant → the timeline / settlement panel shows the clickable "Lock tx ↗" link. Every subsequent settlement transfer is logged the same way.

## How Covenant maps to the judging criteria

**Innovation & Design (35%).** Covenant is *prediction-market treasury routing*: "will this builder ship?" — resolved by a 2-of-N wallet-signed multisig attestation, not by the fund-receiver. Novel financial behavior stacked on top: **grant framing** (milestone grants, not investments), an **investor-controlled judge** model (the builder can't pick their own referees), a **minimum-funding threshold** with backer-withdraw / builder-accept-partial, a **dispute window**, and a **deadline-timeout auto-refund** safety fallback. None of this is a plain deposit form.

**FlowVault Integration (30%).** Real `flowvault-sdk` calls for lock/deposit/withdraw + read-only `getVaultState`/`getRoutingRules` (table above), grounded honestly in the single-contract reality (Hold/Split/Lock mapping above). One shared wrapper (`flowvault.ts` / `escrow.ts`) reused across all four vault types — composability + reusable integrations.

**Technical Execution (20%).** Typed FlowVault error mapping (`mapFlowVaultError`), all amounts handled as **bigint/micro-unit strings, never floats** (single `src/lib/units.ts` source of truth), `getVaultState` polling for read-after-write consistency, case-normalized address comparisons (`src/lib/address.ts`), a full wallet-linked **dashboard**, guided step-by-step UX, and server-side signature verification of every attestation.

**Ecosystem Value (15%).** The **escrow-custodian pattern** is a reusable recipe for *any* conditional-treasury behavior on FlowVault where the outcome depends on a future event — demonstrated across Milestone, Payroll, Reputation, and Insurance vaults from one shared module, so it's clearly a pattern, not a one-off. Other Stacks builders can lift `flowvault.ts` / `escrow.ts` directly.

## Contracts & Deployment

**You do not deploy any custom smart contract.** Covenant consumes FlowVault's already-deployed testnet contracts:

- FlowVault router: `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2` — public functions `set-routing-rules`, `deposit`, `withdraw`, `clear-routing-rules` (verified live on testnet).
- Token (SIP-010): `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` — standard `transfer` / `get-balance`.

The only setup that resembles a "deployment" is **funding the escrow custodian account** (the wallet behind `STACKS_PRIVATE_KEY`) with testnet STX (gas) + USDCx so it can pool and distribute. See the in-app **[Docs page](/docs)** for a click-by-click beginner walkthrough.

### Database (local vs. production)

Off-chain tracking (backers, attestations, reputation, check-ins) lives in a SQLite database via Prisma's driver adapter.

- **Local dev:** a SQLite file (`file:./dev.db`) — a pre-seeded `dev.db` is included.
- **Production (Vercel):** Vercel's filesystem is read-only, so a local file cannot be written. Covenant uses **[Turso](https://turso.tech)** — a hosted, SQLite-compatible (libSQL) database — with **no schema changes**. When `TURSO_DATABASE_URL` is set it is used automatically; otherwise the app falls back to the local file.

One-time Turso setup:

```bash
turso auth signup
turso db create covenant
turso db shell covenant < schema.sql     # creates all tables (generated from the Prisma schema)
turso db show covenant --url             # -> TURSO_DATABASE_URL
turso db tokens create covenant          # -> TURSO_AUTH_TOKEN
```

Then add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `STACKS_PRIVATE_KEY` in **Vercel → Project → Settings → Environment Variables** and redeploy.

## 🚀 Zero to Hero Guide (Even if you've never used Stacks before)

This guide will take you from a completely blank machine to successfully creating, funding, and resolving a real conditional treasury on Stacks testnet — and seeing the on-chain transactions yourself.

### Prerequisites (5 minutes)

1. **Install a Stacks wallet** (choose one):
   - [Xverse](https://www.xverse.app) (recommended for beginners)
   - Leather Wallet

2. **Get free testnet tokens** (you need both):
   - Go to the [Stacks Testnet Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet)
   - Paste your wallet's **testnet STX address** (starts with `ST...`)
   - Request STX (for gas) + note the USDCx if available, or use the token faucet below.

3. **Get testnet USDCx** (the token we use):
   - Use the same faucet or search for a public USDCx testnet dispenser in the Stacks Discord or community.

4. **Terminal + Node.js** (v18+)

### Step-by-step Setup

```bash
# 1. Clone & install
git clone <your-repo-url>
cd covenant
npm install

# 2. Configure environment
cp .env.example .env.local
```

Edit `.env.local` and set at minimum:

```env
NEXT_PUBLIC_FLOWVAULT_NETWORK=testnet
NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS=STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD
NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME=flowvault-v2
NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME=usdcx

# === THE IMPORTANT ONE ===
STACKS_PRIVATE_KEY=your_custodian_private_key_here   # NEVER commit this
DATABASE_URL="file:./dev.db"
```

**How to create the custodian key (server wallet):**

- In your Stacks wallet, create a **new account** on **testnet**.
- Export the **private key** (usually 64 hex characters or WIF).
- Fund that address with the faucet (this address will be the "escrow custodian").
- Paste the private key into `STACKS_PRIVATE_KEY`.

**Important**: The key stays only on your machine in `.env.local`. The frontend never sees it.

```bash
npm run db:push   # syncs the SQLite schema (a pre-seeded dev.db is already included)
npm run dev
```

Open **http://localhost:3000** — or read the built-in **Docs** page at **http://localhost:3000/docs** for the full beginner walkthrough.

**Pro tip**: Click the sun/moon icon in the nav to toggle **Dark Mode** (beautiful deep ledger theme included).

### Full End-to-End Cycle Walkthrough (Real Transactions) — Dummy Edition

**Goal**: You will create a project, send real testnet money to it, lock the money using FlowVault, and then release or refund it — all with clickable explorer links.

**Before you start**: Make sure you have:
- A Stacks testnet wallet connected in the app (your address shows in the top right).
- The `STACKS_PRIVATE_KEY` in `.env.local` belongs to an address that has been funded with testnet USDCx and STX.

#### Step-by-step (with exact things you will see)

1. **Open the app and connect**
   - Go to the live app at https://thecovenant.vercel.app (or http://localhost:3000 if running locally)
   - Click the **CONNECT WALLET** button.
   - Approve in your wallet (Xverse/Leather).
   - Magic: Your address now appears in the top-right nav bar like `ST1ABC...1234` with a copy icon.
   - Click the sun/moon to try **Dark Mode** — the whole site becomes a beautiful dark ledger.

2. **Create your first Covenant**
   - Click **MY COVENANTS** in the nav.
   - Click **+ NEW COVENANT**.
   - Fill the form (copy-paste if you want):
     - Title: `Test Covenant for Demo`
     - Milestone Description: `Launch the landing page and get 100 signups`
     - Funding Goal: `1500`
     - Pick a deadline a few days away.
   - Hit **INITIALIZE COVENANT**.
   - You will be taken to the project detail page.

3. **Explore the Project Detail Page (this is beautiful)**
   - You see a professional timeline on the left.
   - Big **LIVE VAULT BALANCE** box.
   - **CUSTODIAN ADDRESS** section:
     - The long ST... address
     - **COPY** button (click it — it says COPIED!)
     - **CHECK BALANCE** button — click it. It will show something like `0.00 USDCx` (because nothing is there yet).
   - Judge panel (demo 2-of-3).
   - Big "Back this Covenant" box.

4. **Back the project with real money (your first on-chain tx)**
   - In the "Back this Covenant" box, enter `250`.
   - Click the big button.
   - Your wallet will open asking to **sign a transfer** of 250 USDCx to the custodian.
   - Approve the transaction.
   - A toast appears and a new browser tab opens with the **real explorer link**.
   - Go back to the page and refresh.
   - Your contribution now appears in the **Backer Ledger** table with a real tx link next to it.

   Congratulations — you just sent real money on Stacks testnet!

5. **Appoint judges (as a backer)**
   - Only backers who funded can appoint judges — the builder can't pick their own referees.
   - In the judge panel, add a judge address (or click **Add myself as a judge**). Appoint at least one before locking.

6. **Lock the money into FlowVault (the magic programmable part)**
   - In the **SETTLEMENT** section, click **① LOCK FUNDS IN ESCROW** (enabled once funding ≥ your minimum and judges are appointed).
   - The app calls `set-routing-rules` + `deposit` using the custodian key in `.env`.
   - A new explorer link appears — the funds are now locked in FlowVault until the deadline.

7. **Judges attest (wallet-signed)**
   - Each appointed judge connects their wallet and clicks **ATTEST: MET** — their wallet signs the vote and the server verifies the signature.
   - Once 2-of-N sign MET, the covenant moves to the dispute window.

8. **Settle the grant**
   - Click **② DISBURSE GRANT — milestone met** (enabled only after 2-of-N MET). The custodian:
     - Calls `withdraw()` on FlowVault (unlocks the money),
     - Disburses the grant: 80% to the builder, 20% returned pro-rata to backers.
   - (Alternatively **② REFUND BACKERS** if not met, or the **timeout refund** if the deadline passed with no consensus.)
   - Multiple new explorer links will appear.
   - Click them all. You will see real token transfers.

8. **Verify everything**
   - Go back to the project detail — all txs are logged.
   - Click "CHECK BALANCE" on the custodian — the number should have changed.
   - In your own wallet, you should see your pro-rata 20% return (or a full refund if the milestone wasn't met).

You have now completed a full conditional treasury cycle using real FlowVault primitives on testnet.

**This is exactly what judges want to see in your demo video.**

### Troubleshooting for Complete Beginners

- "STACKS_PRIVATE_KEY is required" → You forgot to put the key in `.env.local` or didn't restart the dev server.
- Transaction fails → Your wallet or the custodian has no USDCx. Use the testnet faucet again.
- Page is blank or 500 → Just refresh. The dev server hot-reloads fixes automatically.
- Address not showing after connect → Hard refresh the page (Cmd/Ctrl + Shift + R).
- Dark mode → Toggle the sun/moon icon in the nav. The choice is saved and applied before first paint (no flash) on every page.

### What Makes This Docs Amazing for Dummies

- Every single button click is described.
- Exact text you type is given.
- You are told exactly which explorer links will appear.
- Common "why is it not working" problems are listed.
- You end up with real, auditable testnet transactions — ready for your bounty video and submission.

### Troubleshooting (for Dummies)

- "No key" error on Pool/Resolve → Put a real funded key in `.env.local` and restart the server.
- Transaction fails → Make sure the wallet has enough USDCx **and** the custodian address is funded.
- Page shows 500 / Prisma error → The dev server hot-reloads fixes. Refresh or restart `npm run dev`.
- Can't see your address → Click Connect again or check browser console.
- `prisma db push` errors → make sure `DATABASE_URL` is set (the included `.env.example` has it); the URL lives in `prisma.config.ts` for Prisma 7.

### Useful Helpers Added for You (Zero Friction)

- **Beautiful Wallet UX**: Connect once → your address appears in the nav (truncated + copy). Auto-detects on reload. Full disconnect support.
- **Custodian helpers** (in every project detail):
  - One-click **COPY** for the custodian address.
  - **CHECK BALANCE** button that shows live USDCx balance of the custodian.
- **Dark Mode**: Sun/Moon toggle in the nav. Full beautiful dark ledger theme (persisted).
- All actions produce real explorer links you can click immediately.
- Amazing **Zero-to-Hero docs** right here in this README.

### Dark Mode

Just click the ☀️ / 🌙 icon in the top navigation. It uses a tasteful dark variant of the original parchment/ink design system and is fully persisted.

Enjoy building programmable trust. 

Now go record that demo video — you have everything you need.

## Deliverables Checklist

- [x] **Public GitHub repo** — https://github.com/devIykee/Covenant
- [x] **Working demo** — https://thecovenant.vercel.app (live, primary Milestone Vault flow usable end-to-end)
- [ ] **Demo video** — ⚠️ **TOP-PRIORITY REMAINING GAP.** Record a 2–3 min walkthrough leading with the Milestone Grant flow (create → back → appoint judges → lock → attest → disburse), showing the explorer links. Everything else is done; this is the one blocker.
- [x] **FlowVault integration explanation** — the "FlowVault Integration" section above (Hold/Split/Lock mapping + escrow-custodian rationale)
- [x] **Successful testnet tx** — real `flowvault-v2 deposit` [`d31b9c00…`](https://explorer.hiro.so/txid/d31b9c0039700accf2158990090207cd78619c1977654aa2193cda9ad990d141?chain=testnet), surfaced + clickable in the live app
- [x] **Use of FlowVault SDK/contracts** — `flowvault-sdk` `FlowVault` client; methods + file paths documented in the table above

## Vault Types

The **Milestone-Gated Grant is the flagship**; the other three are secondary behaviors on the same escrow + FlowVault primitives (`src/lib/escrow.ts`). All execute real on-chain USDCx transfers:

- **Milestone-Gated Grant** (flagship): backers fund a grant into escrow; on a verified milestone it's disbursed 80% to the builder / 20% back to backers, else refunded (including the deadline-timeout case).
- **Payroll Vault**: each contributor check-in releases a real USDCx payment; a missed check-in claws the remainder back to the payer.
- **Reputation Vault**: split % auto-computed from each participant's reputation score, then paid pro-rata on-chain.
- **Insurance Pool**: pooled premiums pay the claimant on a declared incident, or refund/roll on expiry.

## Judge Attestation (trustless)

**The builder cannot pick the judges** — that would be judging their own work. Judges are **appointed by backers after they fund** (a backer may appoint themselves); the builder is blocked, and a covenant cannot be pooled/locked until judges are appointed. Each judge connects their wallet and **cryptographically signs** their MET/NOT-MET vote with `@stacks/connect`. The server **verifies the signature** (`@stacks/encryption` `verifyMessageSignatureRsv`) against the judge's address before recording it, and only appointed judges count toward the 2-of-N threshold. A tampered vote fails verification. If the **deadline passes without 2-of-N consensus**, the grant times out and backers are refunded 100%.

## Tech

Next.js App Router + TypeScript + Tailwind (design system from `stitch_covenant_treasury_platform design`)
Prisma + SQLite
flowvault-sdk@0.1.1 + @stacks/connect + @stacks/transactions

## Bounty Notes

The design prioritizes:
- 35% Innovation: real conditional treasury behavior beyond simple wrappers
- 30% FlowVault depth: every major action uses set-rules / deposit / withdraw
- 20% Technical: typed errors, polling state, explorer auditability, shared escrow module
- 15% Ecosystem: composable, documented pattern for future Stacks conditional treasuries

## License

MIT for bounty purposes.
