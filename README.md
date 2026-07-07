# Covenant

**Covenant** is a conditional treasury platform built for the FlowVault Builder Bounty on Stacks testnet.

**Live demo: [thecovenant.vercel.app](https://thecovenant.vercel.app)**

Funds only move when real-world conditions are verifiably met.

- **Flagship feature**: the **Milestone-Based Grant** — a **grantor** locks a pool into a dedicated escrow, awards it to one **builder** against a milestone schedule, and each milestone's tranche is **automatically disbursed** to the builder when independent **judges** attest it met (or **returned to the grantor** if a milestone lapses un-attested).
- Uses FlowVault primitives for time-locking each tranche and deterministic routing (staged re-lock across milestones).
- Real on-chain testnet transactions via the per-program escrow custodian pattern.
- **Grant distribution, not crowdfunding**: a single grantor funds the pool up-front; there are no backers, no pooled investment, and no pro-rata returns.
- Secondary vault types: Payroll (streaming + clawback), Reputation-weighted, Parametric Insurance.

## FlowVault Integration (Required Deliverable)

**Core Truth (per official docs)**: FlowVault provides one contract (`flowvault-v2`) with **principal-scoped routing rules**.

SDK methods used (via the `flowvault-sdk` `FlowVault` client — see `createBackendVault` in `src/lib/flowvault.ts` and the calls in `src/lib/escrow.ts`):

| SDK method | Where (function) | Contract fn |
|---|---|---|
| `setRoutingRules(...)` | `escrow.ts` `lockPoolForProgram` / `poolIntoVault` | `set-routing-rules` |
| `deposit(amount)` | `escrow.ts` `lockPoolForProgram` / `poolIntoVault` | `deposit` |
| `withdraw(amount)` | `escrow.ts` `withdrawFromProgram` / `withdrawFromVault` | `withdraw` |
| `getVaultState(principal)` | `escrow.ts` `getProgramVaultState` | `get-vault-state` (read) |
| `getRoutingRules(principal)` | `escrow.ts` `getRoutingRulesForCustodian` | `get-routing-rules` (read) |
| `clearRoutingRules()` | `escrow.ts` `clearRoutingRules` | `clear-routing-rules` |

### Hold / Split / Lock — how the bounty primitives map to real calls

The bounty lists "Lock Vault Flow / Split Vault Flow / Hold Vault Flow." **These are not separate contracts** — FlowVault ships one `flowvault-v2` contract with principal-scoped routing rules. Covenant implements all three as *behavior* on that single contract:

- **Hold behavior** — funds sit in a program custodian's vault as unlocked balance (plain `deposit` with no lock), withdrawable when a tranche is due.
- **Lock behavior** — `setRoutingRules(lockAmount, lockUntilBlock, …)` + `deposit` time-locks the remaining pool on-chain until the **active milestone's deadline block**; `withdraw` can only pull unlocked balance, always back to the caller.
- **Split behavior** — the routing rule's `splitAddress`/`splitAmount` route part of a deposit to another principal automatically; Covenant performs each milestone payout to the builder (and any grantor return) via tracked SIP-010 transfers (the underlying contract can't branch on a future event — see below).

**Staged re-lock.** Because a principal can hold only one active lock and a time-lock can't release early on a condition, each program uses a **dedicated custodian** and re-locks in stages: the whole remaining pool is locked until the active milestone's deadline; at that deadline the custodian withdraws, pays the earned tranche, and re-locks the remainder until the next milestone. The reconcile engine (`src/lib/reconcile.ts`) advances at most one on-chain step per call, each gated on the previous tx confirming.

This is orchestrated by the **per-program escrow-custodian pattern** because the primitive is *principal-scoped, not program-scoped* — each program gets its own deterministic custodian principal holding one vault (and one lock) for that program's lifecycle. The same `src/lib/flowvault.ts` + `src/lib/escrow.ts` wrapper is **reused across all four vault types** (Grant, Payroll, Reputation, Insurance) — the composability / reusable-integration signal the bounty explicitly rewards.

### Why the Escrow Custodian Pattern

FlowVault routing rules are fixed **at the moment of each deposit** by the depositing principal. There is no native way for the contract to branch destination or amounts based on future events ("did the milestone succeed?").

**Honest architecture**:
1. The **grantor** sends SIP-010 (USDCx) from their own wallet to the program's **dedicated custodian address** (deterministically derived from the master key; the private key is never stored or sent to the client). The program is only publicly listed once that on-chain balance is verified.
2. On **award**, the custodian pools the funds into **its own FlowVault vault** via `setRoutingRules` + `deposit`, locking until the first milestone's deadline. This is where the **real programmable behavior** happens on-chain.
3. At each milestone's deadline, the reconcile engine has the custodian call `withdraw()` on the remaining balance.
4. The custodian then executes tracked SIP-010 transfers (via `@stacks/transactions`) based on the attestation outcome:
   - **Milestone met** (2-of-N judges signed MET): that tranche's % is paid to the builder, then the remainder is re-locked until the next milestone.
   - **Milestone lapsed** (deadline passes with no 2-of-N MET): the remaining pool is returned to the grantor and the program ends. No funds move to the builder.

**Other app-layer decisions worth noting:**
- **Escrow-lock gates listing**: a program can't be publicly listed until the full pool is verified in its custodian on-chain.
- **Deadline-gated payout**: a tranche pays at its milestone's deadline block (a FlowVault time-lock can't release early on a condition), so demo milestones use short deadlines.
- **Grantor names the judges** at award time; the builder cannot attest their own work.

All state changes and distributions are logged with txids + direct explorer links.

**Files**:
- `src/lib/flowvault.ts` — typed wrapper + error mapping
- `src/lib/escrow.ts` — reusable custodian actions (per-program derive, lock, withdraw, transfer)
- `src/lib/reconcile.ts` — the automatic milestone disbursement / expiry state machine
- All features import from these shared modules.

This satisfies bounty emphasis on "depth of use of FlowVault's programmable primitives" and "composability".

## Live testnet transaction (auditable)

A real, executed FlowVault `set-routing-rules` + `deposit` on Stacks testnet, produced by the pool-lock step and **surfaced in the running app** (the program page links straight to the explorer):

- **Tx:** [`d31b9c00…d990d141`](https://explorer.hiro.so/txid/d31b9c0039700accf2158990090207cd78619c1977654aa2193cda9ad990d141?chain=testnet)
- Contract: `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2` · fn `deposit`

Open the [live app](https://thecovenant.vercel.app) → an awarded program → the program page shows the clickable lock tx link, and every milestone payout / grantor return is logged the same way.

## How Covenant maps to the judging criteria

**Innovation & Design (35%).** Covenant is *milestone-gated grant routing*: a grantor's pool is released tranche-by-tranche only as a 2-of-N wallet-signed judge attestation confirms each milestone — never by the fund-receiver. Novel behavior stacked on top: a **staged re-lock** across sequential milestones on a single-lock-per-principal primitive, **automatic** deadline-gated disbursement (no manual release button), **auto-return** of unearned funds to the grantor, and an **escrow-lock gate** that blocks public listing until the pool is on-chain. None of this is a plain deposit form.

**FlowVault Integration (30%).** Real `flowvault-sdk` calls for lock/deposit/withdraw + read-only `getVaultState`/`getRoutingRules` (table above), grounded honestly in the single-contract reality (Hold/Split/Lock mapping above). One shared wrapper (`flowvault.ts` / `escrow.ts`) reused across all four vault types — composability + reusable integrations.

**Technical Execution (20%).** Typed FlowVault error mapping (`mapFlowVaultError`), all amounts handled as **bigint/micro-unit strings, never floats** (single `src/lib/units.ts` source of truth), a **confirmation-gated reconcile engine** that advances one on-chain tx per call to avoid nonce collisions, on-chain balance verification before listing, case-normalized address comparisons (`src/lib/address.ts`), a wallet-linked **grantor/builder/judge dashboard**, guided step-by-step UX, and server-side signature verification of every attestation.

**Ecosystem Value (15%).** The **per-program escrow-custodian + staged re-lock pattern** is a reusable recipe for *any* conditional-treasury behavior on FlowVault where the outcome depends on a future event — demonstrated across Grant, Payroll, Reputation, and Insurance vaults from one shared module, so it's clearly a pattern, not a one-off. Other Stacks builders can lift `flowvault.ts` / `escrow.ts` / `reconcile.ts` directly.

## Contracts & Deployment

**You do not deploy any custom smart contract.** Covenant consumes FlowVault's already-deployed testnet contracts:

- FlowVault router: `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2` — public functions `set-routing-rules`, `deposit`, `withdraw`, `clear-routing-rules` (verified live on testnet).
- Token (SIP-010): `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` — standard `transfer` / `get-balance`.

The only setup that resembles a "deployment" is **funding the escrow custodian account** (the wallet behind `STACKS_PRIVATE_KEY`) with testnet STX (gas) + USDCx so it can pool and distribute. See the in-app **[Docs page](/docs)** for a click-by-click beginner walkthrough.

### Database (local vs. production)

Off-chain tracking (programs, applications, milestones, attestations, distributions, reputation, check-ins) lives in a SQLite database via Prisma's driver adapter.

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

## Zero to Hero Guide (Even if you've never used Stacks before)

This guide will take you from a completely blank machine to successfully creating, funding, and resolving a real conditional treasury on Stacks testnet — and seeing the on-chain transactions yourself.

### Prerequisites (5 minutes)

1. **Install a Stacks wallet** (choose one):
   - [Xverse](https://www.xverse.app) (recommended)
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

### Full End-to-End Cycle Walkthrough (Real Transactions)

**Goal**: As a grantor you'll create a program, lock the pool in FlowVault, award a builder with a milestone schedule, and watch a tranche auto-disburse when judges attest — all with clickable explorer links.

**Before you start**: Make sure you have:
- A Stacks testnet wallet connected in the app (your address shows in the top right).
- The `STACKS_PRIVATE_KEY` in `.env.local` belongs to a funded master custodian address (testnet STX for gas; it gas-funds each per-program custodian).
- Your grantor wallet holds the USDCx pool you intend to award.

#### Step-by-step (with exact things you will see)

1. **Open the app and connect**
   - Go to the live app at https://thecovenant.vercel.app (or http://localhost:3000 locally).
   - Click **CONNECT WALLET** and approve. Your address appears top-right with a copy icon.

2. **Grantor: create a program**
   - Click **PROGRAMS** → **+ NEW PROGRAM**.
   - Title: `Test Grant for Demo` · Description + eligibility conditions · Total pool: `1500` · pick a short horizon.
   - Hit **CREATE PROGRAM** → you land on the program page (status **DRAFT**).

3. **Grantor: fund escrow & publish (your first on-chain tx)**
   - The page shows this program's dedicated **custodian address** and a live balance.
   - Click **SEND POOL TO ESCROW** — your wallet signs a `1500 USDCx` transfer to that custodian. An explorer link opens.
   - Once the balance shows funded, click **PUBLISH PROGRAM** (status → **FUNDED_OPEN**). It's now listed publicly.

4. **Builder: apply** (use a second wallet)
   - Open the program, write a short pitch, click **APPLY TO BUILD**.

5. **Grantor: award + set milestones**
   - Back as the grantor, expand the applicant → **AWARD TO THIS BUILDER**.
   - Add judge address(es) and define milestones (e.g. `Design 20%`, `Build 50%`, `Ship 30%`) each with a short deadline; percentages must sum to 100%.
   - **CONFIRM AWARD & LOCK POOL** — the custodian runs `set-routing-rules` + `deposit`, locking the pool until milestone 1's deadline (status → **AWARDED**). A lock explorer link appears.

6. **Builder → judges → automatic payout**
   - Builder clicks **MARK MILESTONE READY FOR REVIEW**.
   - Each judge connects their wallet and clicks **ATTEST MET** — the wallet signs; the server verifies the signature.
   - At the milestone's deadline block, the reconcile engine automatically `withdraw`s, pays that tranche to the builder, and re-locks the remainder for milestone 2 — **no manual release**. Loading the page (or the sync endpoint) advances it.

7. **Verify everything**
   - The milestone checklist shows each tranche's state (LOCKED → IN REVIEW → PAID) with a payout explorer link.
   - Let a milestone deadline pass **un-attested** to see the auto-expire path: the remaining pool is returned to the grantor and the program ends (status → **EXPIRED**).

You have now completed a full milestone-grant cycle using real FlowVault primitives on testnet.



### Troubleshooting for Complete Beginners

- "STACKS_PRIVATE_KEY is required" → You forgot to put the key in `.env.local` or didn't restart the dev server.
- Transaction fails → Your wallet or the custodian has no USDCx. Use the testnet faucet again.
- Page is blank or 500 → Just refresh. The dev server hot-reloads fixes automatically.
- Address not showing after connect → Hard refresh the page (Cmd/Ctrl + Shift + R).
- Dark mode → Toggle the sun/moon icon in the nav. The choice is saved and applied before first paint (no flash) on every page.
- "No key" error on fund/lock/attest → Put a real funded key in `.env.local` and restart the server.
- Transaction fails → Make sure the wallet has enough USDCx **and** the custodian address is funded.
- Page shows 500 / Prisma error → The dev server hot-reloads fixes. Refresh or restart `npm run dev`.
- Can't see your address → Click Connect again or check browser console.
- `prisma db push` errors → make sure `DATABASE_URL` is set (the included `.env.example` has it); the URL lives in `prisma.config.ts` for Prisma 7.

## Vault Types

The **Milestone-Based Grant is the flagship**; the other three are secondary behaviors on the same escrow + FlowVault primitives (`src/lib/escrow.ts`). All execute real on-chain USDCx transfers:

- **Milestone-Based Grant** (flagship): a grantor locks a pool; each milestone's tranche auto-disburses to the awarded builder when judges attest it met, or the remainder returns to the grantor if a milestone lapses.
- **Payroll Vault**: each contributor check-in releases a real USDCx payment; a missed check-in claws the remainder back to the payer.
- **Reputation Vault**: split % auto-computed from each participant's reputation score, then paid pro-rata on-chain.
- **Insurance Pool**: pooled premiums pay the claimant on a declared incident, or refund/roll on expiry.

## Judge Attestation (trustless)

**The builder cannot attest their own work.** The **grantor names the judges** at award time. For the currently-active milestone, each judge connects their wallet and **cryptographically signs** their MET/NOT-MET vote with `@stacks/connect`. The server **verifies the signature** (`@stacks/encryption` `verifyMessageSignatureRsv`) against the judge's address before recording it, and only named judges count toward the 2-of-N threshold. A tampered vote fails verification. Attestation gates the **deadline-gated** payout: at the milestone's deadline block a MET-attested tranche pays the builder automatically; if the deadline passes without 2-of-N MET, the remaining pool is returned to the grantor.

## Tech

Next.js App Router + TypeScript + Tailwind (design system from `stitch_covenant_treasury_platform design`)
Prisma + SQLite
flowvault-sdk@0.1.1 + @stacks/connect + @stacks/transactions

## License

MIT.
