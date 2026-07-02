import { NextRequest, NextResponse } from "next/server";
import { createBackendVault } from "@/src/lib/flowvault";
import { getCustodianAddress } from "@/src/lib/escrow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const vault = createBackendVault();
    const addr = await getCustodianAddress();
    const state = await vault.getVaultState(addr);
    return NextResponse.json(state);
  } catch (e: any) {
    return NextResponse.json({ unlocked: "0", locked: "0", error: e.message });
  }
}
