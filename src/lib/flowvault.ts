/**
 * Covenant - FlowVault SDK Wrapper
 * Shared, reusable FlowVault integration per official docs.
 * 
 * Do NOT put private keys in client bundles.
 * Backend (server actions / API) uses senderKey.
 * Browser uses @stacks/connect executor.
 */

import { FlowVault } from "flowvault-sdk";
import type {
  FlowVaultConfig,
  TransactionResult,
  VaultState,
  RoutingRules,
} from "flowvault-sdk";

// Env constants (must match exactly)
export const FLOWVAULT_NETWORK = (process.env.NEXT_PUBLIC_FLOWVAULT_NETWORK || "testnet") as "testnet" | "mainnet";
export const FLOWVAULT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS || "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD";
export const FLOWVAULT_CONTRACT_NAME = process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME || "flowvault-v2";
export const FLOWVAULT_TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
export const FLOWVAULT_TOKEN_CONTRACT_NAME = process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME || "usdcx";

// Explorer base
export const EXPLORER_BASE = "https://explorer.hiro.so";

// Typed error names from SDK
export const FLOWVAULT_ERRORS = {
  InvalidAmountError: "InvalidAmountError",
  InvalidAddressError: "InvalidAddressError",
  InvalidRoutingRuleError: "InvalidRoutingRuleError",
  InvalidConfigurationError: "InvalidConfigurationError",
  ContractCallError: "ContractCallError",
  NetworkError: "NetworkError",
  ParsingError: "ParsingError",
} as const;

export type FlowVaultErrorName = keyof typeof FLOWVAULT_ERRORS;

export interface FlowVaultError extends Error {
  name: FlowVaultErrorName;
}

// Get user-facing message from SDK error
export function mapFlowVaultError(error: unknown): string {
  const err = error as FlowVaultError | Error;
  const name = (err as any)?.name || err?.constructor?.name || "Error";

  switch (name) {
    case FLOWVAULT_ERRORS.InvalidAmountError:
      return "Invalid amount. Amount must be a positive integer string in micro-units.";
    case FLOWVAULT_ERRORS.InvalidAddressError:
      return "Invalid Stacks address. Ensure it is a valid STX principal (ST... or SP...).";
    case FLOWVAULT_ERRORS.InvalidRoutingRuleError:
      return "Invalid routing rules. Lock + split cannot exceed deposit, and lock block must be in the future.";
    case FLOWVAULT_ERRORS.InvalidConfigurationError:
      return "Invalid configuration. Check network/contract principals.";
    case FLOWVAULT_ERRORS.ContractCallError:
      return "Contract call failed. Check your balance, fees, and that the vault allows the action.";
    case FLOWVAULT_ERRORS.NetworkError:
      return "Network error. Please check your connection and try again.";
    case FLOWVAULT_ERRORS.ParsingError:
      return "Failed to parse contract response. Contract address may be mismatched.";
    default:
      return err.message || "An unexpected error occurred with FlowVault.";
  }
}

// Create backend signer instance (server only - custodian)
export function createBackendVault(): FlowVault {
  const senderKey = process.env.STACKS_PRIVATE_KEY;
  if (!senderKey) {
    throw new Error("STACKS_PRIVATE_KEY is required for escrow custodian operations (server-side only).");
  }

  return new FlowVault({
    network: FLOWVAULT_NETWORK,
    contractAddress: FLOWVAULT_CONTRACT_ADDRESS,
    contractName: FLOWVAULT_CONTRACT_NAME,
    tokenContractAddress: FLOWVAULT_TOKEN_CONTRACT_ADDRESS,
    tokenContractName: FLOWVAULT_TOKEN_CONTRACT_NAME,
    senderKey,
  });
}

// Create browser wallet-mode instance (client)
export function createWalletVault(senderAddress: string, contractCallExecutor: (call: any) => Promise<any>): FlowVault {
  return new FlowVault({
    network: FLOWVAULT_NETWORK,
    contractAddress: FLOWVAULT_CONTRACT_ADDRESS,
    contractName: FLOWVAULT_CONTRACT_NAME,
    tokenContractAddress: FLOWVAULT_TOKEN_CONTRACT_ADDRESS,
    tokenContractName: FLOWVAULT_TOKEN_CONTRACT_NAME,
    senderAddress,
    contractCallExecutor,
  });
}

// Helper: format tx explorer link
export function getExplorerTxUrl(txid: string): string {
  const clean = txid.replace(/^0x/, "");
  return `${EXPLORER_BASE}/txid/${clean}?chain=${FLOWVAULT_NETWORK}`;
}

// Safe amount helpers (string/bigint only, no float)
export function toMicro(amount: string | bigint): string {
  // Assume caller passes whole units? For USDCx assume 6 decimals.
  // But per SDK: pass the raw micro value as string.
  // This is a no-op passthrough for raw micro amounts. Keep explicit.
  return String(amount);
}

export async function getCurrentBlockHeight(): Promise<number> {
  // Use the SDK helper if exposed, else approximate via direct.
  // SDK provides getCurrentBlockHeight on instance, but static helper for convenience.
  // For simplicity we can use a public Stacks API.
  try {
    const api = FLOWVAULT_NETWORK === "testnet"
      ? "https://api.testnet.hiro.so"
      : "https://api.hiro.so";
    const res = await fetch(`${api}/extended/v1/block?limit=1`);
    const data = await res.json();
    return data.results?.[0]?.height ?? 0;
  } catch {
    return 0;
  }
}

// Re-export types
export type { VaultState, RoutingRules, TransactionResult };
