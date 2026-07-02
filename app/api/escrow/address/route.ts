import { NextResponse } from "next/server";
import { getCustodianAddress } from "@/src/lib/escrow";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const address = await getCustodianAddress();
    return NextResponse.json({ address });
  } catch (e: any) {
    return NextResponse.json({ address: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", error: e.message }, { status: 200 });
  }
}
