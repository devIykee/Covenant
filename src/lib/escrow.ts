/**
 * Covenant - Escrow Custodian Service
 * 
 * This is the core pattern for using FlowVault correctly:
 * - Custodian (backend) controls one vault per covenant/project/pool.
 * - Users send SIP-010 (USDCx) directly to the known custodian address (off-chain tracked).
 * - Custodian pools into its own vault using setRoutingRules + deposit (executes lock/split).
 * - At resolution, custodian withdraws (after lockUntilBlock) and distributes via SIP-010 transfers.
 *
 * IMPORTANT: FlowVault rules are PRINCIPAL-SCOPED and fixed at deposit time.
 * There is no native "if success then X else Y" branching inside the contract.
 * Conditional outcomes are enforced at the application layer.
 */

import { createBackendVault, mapFlowVaultError, FLOWVAULT_NETWORK, FLOWVAULT_CONTRACT_ADDRESS, FLOWVAULT_TOKEN_CONTRACT_ADDRESS, FLOWVAULT_TOKEN_CONTRACT_NAME } from "./flowvault";
import { getExplorerTxUrl } from "./flowvault";
import type { TransactionResult, VaultState, RoutingRules } from "flowvault-sdk";

// The custodian's own address (derived from STACKS_PRIVATE_KEY).
// For demo we surface it in UI for users to send funds to.
let cachedCustodianAddress: string | null = null;

export async function getCustodianAddress(): Promise<string> {
  if (cachedCustodianAddress) return cachedCustodianAddress;

  const privateKey = process.env.STACKS_PRIVATE_KEY;
  if (!privateKey) {
    // Fallback for demo without key
    cachedCustodianAddress = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    return cachedCustodianAddress;
  }

  // Derive STX address from private key. IMPORTANT: pass the network so testnet
  // yields the ST... form (the default is mainnet SP..., which would be wrong here).
  const { getAddressFromPrivateKey } = await import("@stacks/transactions");
  const address = getAddressFromPrivateKey(privateKey, FLOWVAULT_NETWORK);
  cachedCustodianAddress = address;
  return address;
}

// Common: configure + deposit pooled funds into the custodian's vault for a given "owner" (we use project id as label, but rules are per custodian principal)
export interface DepositConfig {
  lockAmount: string;        // micro units as string
  lockUntilBlock: number;
  splitAddress?: string | null;
  splitAmount?: string;
}

export async function poolIntoVault(
  totalAmount: string,
  config: DepositConfig,
  label?: string // for logging
): Promise<{ txid: string; explorerUrl: string }> {
  const vault = createBackendVault();

  try {
    // 1. Set routing rules (per-custodian principal)
    const setRulesResult = await vault.setRoutingRules({
      lockAmount: config.lockAmount,
      lockUntilBlock: config.lockUntilBlock,
      splitAddress: config.splitAddress || null,
      splitAmount: config.splitAmount || "0",
    });

    const setTx = (setRulesResult as any).txid || (setRulesResult as any).txId || "";
    console.log(`[${label || "escrow"}] setRoutingRules tx: ${setTx}`);

    // 2. Deposit the pooled amount (executes the pipeline deterministically)
    const depositResult = await vault.deposit(totalAmount);

    const txid = (depositResult as any).txid || (depositResult as any).txId || "";
    console.log(`[${label || "escrow"}] deposit tx: ${txid}`);

    return {
      txid,
      explorerUrl: getExplorerTxUrl(txid || ""),
    };
  } catch (err) {
    console.error("FlowVault pool error", err);
    throw new Error(mapFlowVaultError(err));
  }
}

export async function withdrawFromVault(
  amount: string,
  label?: string
): Promise<{ txid: string; explorerUrl: string }> {
  const vault = createBackendVault();

  try {
    const result: any = await vault.withdraw(amount);
    const wtx = result.txid || result.txId || "";
    return {
      txid: wtx,
      explorerUrl: getExplorerTxUrl(wtx),
    };
  } catch (err) {
    throw new Error(mapFlowVaultError(err));
  }
}

export async function getVaultStateForCustodian(): Promise<VaultState> {
  const vault = createBackendVault();
  const address = await getCustodianAddress();
  return vault.getVaultState(address);
}

export async function getRoutingRulesForCustodian(): Promise<any> {
  const vault = createBackendVault();
  const address = await getCustodianAddress();
  return vault.getRoutingRules(address);
}

export async function clearRoutingRules(): Promise<TransactionResult> {
  const vault = createBackendVault();
  return vault.clearRoutingRules();
}

// For resolution distributions: perform direct SIP-010 token transfers from custodian
// to recipients (builder, backers, etc). These are tracked separately.
import { Cl, makeContractCall, broadcastTransaction, AnchorMode } from "@stacks/transactions";

export interface TransferResult {
  txid: string;
  explorerUrl: string;
}

export async function transferToken(
  recipient: string,
  amountMicro: string,
  memo?: string
): Promise<TransferResult> {
  const privateKey = process.env.STACKS_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("STACKS_PRIVATE_KEY is required for escrow custodian operations (server-side only).");
  }
  const net = await import("@stacks/network");
  // Use ready-made network instances exported by the package
  const network = process.env.NEXT_PUBLIC_FLOWVAULT_NETWORK === "mainnet"
    ? (net as any).STACKS_MAINNET || new (net as any).StacksMainnet()
    : (net as any).STACKS_TESTNET || new (net as any).StacksTestnet();

  // SIP-010 transfer
  const txOptions = {
    contractAddress: FLOWVAULT_TOKEN_CONTRACT_ADDRESS,
    contractName: FLOWVAULT_TOKEN_CONTRACT_NAME,
    functionName: "transfer",
    functionArgs: [
      Cl.uint(BigInt(amountMicro)),
      Cl.principal(await getCustodianAddress()),
      Cl.principal(recipient),
      memo ? Cl.some(Cl.bufferFromUtf8(memo)) : Cl.none(),
    ],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: 0x01 as any,
  };

  const tx = await makeContractCall(txOptions);
  const broadcastResponse: any = await broadcastTransaction({ transaction: tx, network });

  // v7 broadcastTransaction resolves to { txid } on success, or a rejection
  // object ({ error, reason, ... }) on failure. Never a bare string.
  const txid = broadcastResponse?.txid || "";
  if (!txid) {
    const reason = broadcastResponse?.reason || broadcastResponse?.error || "unknown reason";
    const detail = broadcastResponse?.reason_data ? ` (${JSON.stringify(broadcastResponse.reason_data)})` : "";
    throw new Error(`Transfer to ${recipient} was rejected: ${reason}${detail}`);
  }

  return {
    txid,
    explorerUrl: getExplorerTxUrl(txid),
  };
}

// Helper to compute pro-rata shares (string math, integer)
export function computeProRataShares(contributions: { principal: string; amount: string }[], total: string): Array<{ principal: string; share: string }> {
  const totalBig = BigInt(total);
  if (totalBig === BigInt(0)) return [];

  return contributions.map((c) => {
    const share = (BigInt(c.amount) * BigInt(10000)) / totalBig; // basis points for precision
    const amountShare = (BigInt(c.amount) * BigInt(total)) / totalBig; // pro-rata of actual total
    return { principal: c.principal, share: amountShare.toString() };
  });
}
