import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { getUsdcxBalance, getProgramCustodianAddress, getTxStatus } from "@/src/lib/escrow";
import { getExplorerTxUrl } from "@/src/lib/flowvault";
import { formatUsdcx } from "@/src/lib/units";
import { eqAddr } from "@/src/lib/address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The grantor has sent the full pool from their own wallet to the program's
// escrow custodian. This route verifies the funds actually landed on-chain
// (custodian USDCx balance >= pool) and only then flips the program to
// FUNDED_OPEN — the gate that makes it publicly listed and open to applicants.
//
// We intentionally verify by on-chain BALANCE (not just a txid) so a program can
// never be listed as funded unless the money is genuinely in escrow.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { fundTxid, grantorAddress } = body;

  const db = getDb();
  const program = await db.grantProgram.findUnique({ where: { id } });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  if (grantorAddress && !eqAddr(grantorAddress, program.grantorAddress)) {
    return NextResponse.json({ error: "Only the grantor can fund this program." }, { status: 403 });
  }
  if (program.status !== "DRAFT") {
    return NextResponse.json({ error: `Program is already ${program.status}.` }, { status: 400 });
  }

  const custodian = program.custodianAddress || getProgramCustodianAddress(id);

  // If a funding txid was supplied, make sure it isn't still pending / failed.
  if (fundTxid) {
    const status = await getTxStatus(fundTxid);
    if (status === "pending") {
      return NextResponse.json({ error: "Funding transfer is still pending confirmation — try again shortly.", pending: true }, { status: 409 });
    }
    if (status === "failed") {
      return NextResponse.json({ error: "The funding transfer failed on-chain. Please retry the transfer." }, { status: 400 });
    }
  }

  // Ground truth: does the custodian actually hold at least the full pool?
  const balance = await getUsdcxBalance(custodian);
  const required = BigInt(program.totalPool);
  if (BigInt(balance) < required) {
    return NextResponse.json(
      {
        error: `Escrow holds ${formatUsdcx(balance)} USDCx but the pool requires ${formatUsdcx(program.totalPool)} USDCx. Send the full pool to the custodian, then confirm.`,
        custodianAddress: custodian,
        balance,
        required: program.totalPool,
      },
      { status: 400 }
    );
  }

  const explorerUrl = fundTxid ? getExplorerTxUrl(fundTxid) : null;
  await db.grantProgram.update({
    where: { id },
    data: {
      status: "FUNDED_OPEN",
      custodianAddress: custodian,
      fundTxid: fundTxid || null,
      fundExplorerUrl: explorerUrl,
    },
  });
  await db.programStateLog.create({
    data: { programId: id, status: "FUNDED_OPEN", note: "Pool verified in escrow — program open to applicants", txid: fundTxid || null, explorerUrl },
  });

  return NextResponse.json({ ok: true, status: "FUNDED_OPEN", custodianAddress: custodian, balance });
}
