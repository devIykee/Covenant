// Client-side USDCx deposit helper.
//
// Investors / payers / pool members fund a vault by signing a real SIP-010
// `transfer` of USDCx from their own wallet to the escrow custodian. The custodian
// later distributes those funds. This is the browser side of the escrow pattern.

import { request, connect, getLocalStorage } from "@stacks/connect";
import { Cl } from "@stacks/transactions";
import {
  FLOWVAULT_TOKEN_CONTRACT_ADDRESS,
  FLOWVAULT_TOKEN_CONTRACT_NAME,
  FLOWVAULT_NETWORK,
  getExplorerTxUrl,
} from "./flowvault";

export async function getConnectedStxAddress(): Promise<string> {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("covenant-address");
    if (saved && saved.startsWith("ST")) return saved;
  }
  let stx = getLocalStorage()?.addresses?.stx?.[0]?.address;
  if (stx) return stx;
  await connect();
  stx = getLocalStorage()?.addresses?.stx?.[0]?.address;
  if (stx) {
    try {
      localStorage.setItem("covenant-address", stx);
    } catch {
      /* ignore */
    }
    return stx;
  }
  throw new Error("Connect your wallet first.");
}

async function getCustodianAddress(): Promise<string> {
  const res = await fetch("/api/escrow/address");
  const data = await res.json();
  if (!data?.address) throw new Error("Could not resolve custodian address.");
  return data.address;
}

export interface DepositResult {
  txid: string;
  explorerUrl: string;
  sender: string;
  custodian: string;
}

// amountMicro: USDCx in micro-units (6 decimals) as a string.
export async function depositUsdcxToCustodian(amountMicro: string): Promise<DepositResult> {
  const sender = await getConnectedStxAddress();
  const custodian = await getCustodianAddress();

  const contract = `${FLOWVAULT_TOKEN_CONTRACT_ADDRESS}.${FLOWVAULT_TOKEN_CONTRACT_NAME}`;
  const functionArgs = [
    Cl.uint(BigInt(amountMicro)),
    Cl.principal(sender),
    Cl.principal(custodian),
    Cl.none(),
  ];

  const params: any = {
    contract,
    functionName: "transfer",
    functionArgs,
    network: FLOWVAULT_NETWORK,
    postConditionMode: "allow",
  };
  const result: any = await request("stx_callContract", params);

  const txid = result?.txid || result?.txId || result?.transactionId || "";
  if (!txid) throw new Error("Transfer submitted but no transaction id was returned.");

  return { txid, explorerUrl: getExplorerTxUrl(txid), sender, custodian };
}

// Convert a whole-USDCx string/number to micro-units string.
export function toMicroUsdcx(whole: string | number): string {
  return BigInt(Math.round(Number(whole) * 1_000_000)).toString();
}
