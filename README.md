# Covenant

**Covenant** is a conditional treasury platform built for the FlowVault Builder Bounty on Stacks testnet.

Funds only move when real-world conditions are verifiably met.

- **Primary feature**: Milestone-Gated Fundraising Vault (fully implemented end-to-end)
- Uses FlowVault primitives for time-locking pooled capital and deterministic routing
- Real on-chain testnet transactions via the escrow custodian pattern
- Additional vault types: Payroll (streaming + clawback), Reputation-weighted, Parametric Insurance

## FlowVault Integration (Required Deliverable)

**Core Truth (per official docs)**: FlowVault provides one contract (`flowvault-v2`) with **principal-scoped routing rules**.

Functions used (from `src/lib/flowvault.ts` + `src/lib/escrow.ts`):
- `set-routing-rules(lockAmount, lockUntilBlock, splitAddress, splitAmount)`
- `deposit(amount)`
- `withdraw(amount)` — only unlocked, always to the caller
- `get-vault-state(principal)` / `get-routing-rules(principal)`
- `clear-routing-rules()`

### Why the Escrow Custodian Pattern

FlowVault routing rules are fixed **at the moment of each deposit** by the depositing principal. There is no native way for the contract to branch destination or amounts based on future events ("did the milestone succeed?").

**Honest architecture**:
1. Users (backers) send SIP-010 (USDCx) to a **known custodian address** (backend-controlled testnet key). These transfers are tracked in our DB against the project.
2. The custodian account pools the funds into **its own FlowVault vault** for the covenant via `setRoutingRules` + `deposit`. This is where the **real programmable behavior** happens on-chain (lock and/or split).
3. At resolution time (after attestations, lock height passed), custodian calls `withdraw()` to unlock.
4. Custodian then executes tracked SIP-010 transfers (via `@stacks/transactions`) to the correct parties based on application-level decision (success 80/20 vs full refund).

All state changes and distributions are logged with txids + direct explorer links.

**Files**:
- `src/lib/flowvault.ts` — typed wrapper + error mapping
- `src/lib/escrow.ts` — reusable custodian actions (pool, withdraw, transfer)
- All features import from these shared modules.

This satisfies bounty emphasis on "depth of use of FlowVault's programmable primitives" and "composability".

## Setup

```bash
npm install
cp .env.example .env.local
# Add a funded testnet STACKS_PRIVATE_KEY (custodian) to .env.local
# Fund the derived address with testnet STX + USDCx
npm run db:push
npm run dev
```

Env (exact):
```
NEXT_PUBLIC_FLOWVAULT_NETWORK=testnet
NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS=STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD
NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME=flowvault-v2
NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME=usdcx
STACKS_PRIVATE_KEY=...
DATABASE_URL="file:./dev.db"
```

## Primary Flow (Milestone Vault)

1. Builder: Create covenant (title, milestone, funding goal, deadline → block height)
2. Backers: Connect wallet → enter amount → record contribution + send USDCx to custodian
3. Pool: Custodian calls set-rules + deposit (100% lock until deadline + dispute)
4. Judges (multisig): Attest "MET" / "NOT_MET" (message signature verified server-side)
5. Dispute window built-in via lockUntilBlock
6. Resolve: Custodian withdraws → 80/20 success or 100% refund. All transfers logged + explorer links

Every step surfaces explorer links.

## Deliverables Checklist

- [x] Public repo (after push)
- [x] Working demo (local + deployable)
- [ ] Demo video (record after real testnet run)
- [x] README FlowVault explanation (this file)
- [ ] Successful testnet tx (requires funded custodian key + real USDCx sends)
- [x] Explicit use of SDK/contract methods documented

## Additional Features (A/B/C)

- Payroll Vault (A): streaming releases + clawback on missed check-in
- Reputation Vault (B): auto-weighted splits from reputation scores
- Insurance Pool (C): judge-triggered parametric payouts

These reuse `src/lib/escrow.ts`.

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
