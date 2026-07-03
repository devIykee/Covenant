import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { getProgramCustodianAddress, getUsdcxBalance } from "@/src/lib/escrow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public: the escrow custodian address for a program + its current on-chain
// USDCx balance. The grantor sends the pool here; the funding UI polls this to
// show progress toward "fully funded". No private material is ever returned.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await getDb().grantProgram.findUnique({ where: { id } });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  const address = program.custodianAddress || getProgramCustodianAddress(id);
  const balance = await getUsdcxBalance(address);

  return NextResponse.json({
    address,
    balance,
    required: program.totalPool,
    funded: BigInt(balance) >= BigInt(program.totalPool),
  });
}
