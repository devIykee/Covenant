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

// For resolution distributions: perform direct SIP-010 token transfers from a
// custodian (master or per-program) to recipients. These are tracked separately.
import {
  Cl,
  cvToValue,
  makeContractCall,
  makeSTXTokenTransfer,
  broadcastTransaction,
  fetchCallReadOnlyFunction,
  getAddressFromPrivateKey,
  AnchorMode,
} from "@stacks/transactions";
import { createHmac } from "node:crypto";

export interface TransferResult {
  txid: string;
  explorerUrl: string;
}

// Ready-made network instance for the configured chain.
export async function getStacksNetwork(): Promise<any> {
  const net = await import("@stacks/network");
  return FLOWVAULT_NETWORK === "mainnet"
    ? (net as any).STACKS_MAINNET || new (net as any).StacksMainnet()
    : (net as any).STACKS_TESTNET || new (net as any).StacksTestnet();
}

// SIP-010 USDCx transfer signed by an arbitrary custodian key.
export async function transferTokenFrom(
  senderKey: string,
  senderAddress: string,
  recipient: string,
  amountMicro: string,
  memo?: string
): Promise<TransferResult> {
  const network = await getStacksNetwork();

  const txOptions = {
    contractAddress: FLOWVAULT_TOKEN_CONTRACT_ADDRESS,
    contractName: FLOWVAULT_TOKEN_CONTRACT_NAME,
    functionName: "transfer",
    functionArgs: [
      Cl.uint(BigInt(amountMicro)),
      Cl.principal(senderAddress),
      Cl.principal(recipient),
      memo ? Cl.some(Cl.bufferFromUtf8(memo)) : Cl.none(),
    ],
    senderKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: 0x01 as any,
  };

  const tx = await makeContractCall(txOptions);
  const broadcastResponse: any = await broadcastTransaction({ transaction: tx, network });

  const txid = broadcastResponse?.txid || "";
  if (!txid) {
    const reason = broadcastResponse?.reason || broadcastResponse?.error || "unknown reason";
    const detail = broadcastResponse?.reason_data ? ` (${JSON.stringify(broadcastResponse.reason_data)})` : "";
    throw new Error(`Transfer to ${recipient} was rejected: ${reason}${detail}`);
  }

  return { txid, explorerUrl: getExplorerTxUrl(txid) };
}

// Master-custodian SIP-010 transfer (used by the secondary vault features).
export async function transferToken(
  recipient: string,
  amountMicro: string,
  memo?: string
): Promise<TransferResult> {
  const privateKey = process.env.STACKS_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("STACKS_PRIVATE_KEY is required for escrow custodian operations (server-side only).");
  }
  return transferTokenFrom(privateKey, await getCustodianAddress(), recipient, amountMicro, memo);
}

// ------------------------------------------------------------------
// Per-program escrow custodians (grant model)
//
// Each grant program gets its own deterministic custodian keypair so one
// grantor's funds are never commingled on-chain with another's — and, crucially,
// so each program can hold its own single active FlowVault lock (the contract
// allows one lock rule per principal). Keys are derived from the master key and
// never stored or sent to the client.
// ------------------------------------------------------------------

function masterKey(): string {
  const k = process.env.STACKS_PRIVATE_KEY;
  if (!k) throw new Error("STACKS_PRIVATE_KEY is required for escrow custodian operations (server-side only).");
  return k;
}

export interface ProgramCustodian {
  address: string;
  privateKey: string; // SERVER-ONLY. never return this to the client.
}

// Deterministic per-program custodian. Recomputable from the master key + id.
export function deriveProgramCustodian(programId: string): ProgramCustodian {
  const digest = createHmac("sha256", masterKey())
    .update(`covenant-program:${programId}`)
    .digest("hex"); // 32 bytes -> valid secp256k1 scalar (compressed key form)
  const privateKey = `${digest}01`; // compressed-pubkey private key form
  const address = getAddressFromPrivateKey(privateKey, FLOWVAULT_NETWORK);
  return { address, privateKey };
}

// Safe: the address only (for display / funding target / balance reads).
export function getProgramCustodianAddress(programId: string): string {
  return deriveProgramCustodian(programId).address;
}

// On-chain status of a tx: "success" | "pending" | "failed" | "unknown".
// The reconcile engine gates each on-chain step on the previous one confirming.
export async function getTxStatus(txid: string): Promise<"success" | "pending" | "failed" | "unknown"> {
  if (!txid) return "unknown";
  const clean = txid.replace(/^0x/, "");
  const api = FLOWVAULT_NETWORK === "testnet" ? "https://api.testnet.hiro.so" : "https://api.hiro.so";
  try {
    const res = await fetch(`${api}/extended/v1/tx/0x${clean}`);
    if (res.status === 404) return "pending"; // not yet indexed
    if (!res.ok) return "unknown";
    const data = await res.json();
    const s = data?.tx_status as string | undefined;
    if (s === "success") return "success";
    if (s === "pending") return "pending";
    if (s && s.startsWith("abort")) return "failed";
    return "unknown";
  } catch {
    return "unknown";
  }
}

// Read a principal's on-chain USDCx balance (micro units as string).
export async function getUsdcxBalance(address: string): Promise<string> {
  const network = await getStacksNetwork();
  try {
    const res: any = await fetchCallReadOnlyFunction({
      contractAddress: FLOWVAULT_TOKEN_CONTRACT_ADDRESS,
      contractName: FLOWVAULT_TOKEN_CONTRACT_NAME,
      functionName: "get-balance",
      functionArgs: [Cl.principal(address)],
      senderAddress: address,
      network,
    });
    const val = cvToValue(res);
    // get-balance returns (ok uintV); cvToValue unwraps to { value } or a bigint.
    const raw = val?.value ?? val;
    return BigInt(raw ?? 0).toString();
  } catch {
    return "0";
  }
}

// Master custodian tops up a program custodian with STX so it can pay tx fees.
export async function fundGasForProgram(programId: string, microStx = BigInt(3_000_000)): Promise<TransferResult> {
  const { address } = deriveProgramCustodian(programId);
  const network = await getStacksNetwork();
  const tx = await makeSTXTokenTransfer({
    recipient: address,
    amount: microStx,
    senderKey: masterKey(),
    network,
  });
  const resp: any = await broadcastTransaction({ transaction: tx, network });
  const txid = resp?.txid || "";
  if (!txid) {
    const reason = resp?.reason || resp?.error || "unknown reason";
    throw new Error(`Gas top-up to program custodian was rejected: ${reason}`);
  }
  return { txid, explorerUrl: getExplorerTxUrl(txid) };
}

// Program custodian locks an amount in FlowVault until `lockUntilBlock` (set rules + deposit).
export async function lockPoolForProgram(
  programId: string,
  amountMicro: string,
  lockUntilBlock: number
): Promise<TransferResult> {
  const { privateKey } = deriveProgramCustodian(programId);
  const vault = createBackendVault(privateKey);
  try {
    await vault.setRoutingRules({
      lockAmount: amountMicro,
      lockUntilBlock,
      splitAddress: null,
      splitAmount: "0",
    });
    const depositResult: any = await vault.deposit(amountMicro);
    const txid = depositResult?.txid || depositResult?.txId || "";
    return { txid, explorerUrl: getExplorerTxUrl(txid || "") };
  } catch (err) {
    throw new Error(mapFlowVaultError(err));
  }
}

// Program custodian withdraws unlocked funds from its FlowVault vault.
export async function withdrawFromProgram(programId: string, amountMicro: string): Promise<TransferResult> {
  const { privateKey } = deriveProgramCustodian(programId);
  const vault = createBackendVault(privateKey);
  try {
    const result: any = await vault.withdraw(amountMicro);
    const txid = result?.txid || result?.txId || "";
    return { txid, explorerUrl: getExplorerTxUrl(txid) };
  } catch (err) {
    throw new Error(mapFlowVaultError(err));
  }
}

// Live FlowVault state for a program's custodian principal.
export async function getProgramVaultState(programId: string): Promise<VaultState> {
  const { address, privateKey } = deriveProgramCustodian(programId);
  const vault = createBackendVault(privateKey);
  return vault.getVaultState(address);
}

// Program custodian transfers USDCx to a recipient (milestone payout / grantor return).
export async function transferFromProgram(
  programId: string,
  recipient: string,
  amountMicro: string,
  memo?: string
): Promise<TransferResult> {
  const { address, privateKey } = deriveProgramCustodian(programId);
  return transferTokenFrom(privateKey, address, recipient, amountMicro, memo);
}
