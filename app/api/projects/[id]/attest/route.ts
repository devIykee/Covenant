import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { verifyMessageSignatureRsv } from "@stacks/encryption";
import { getAddressFromPublicKey } from "@stacks/transactions";
import { FLOWVAULT_NETWORK } from "@/src/lib/flowvault";
import { eqAddr, includesAddr } from "@/src/lib/address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { judge, vote, signature, publicKey } = await req.json();

  if (!judge || !vote || !signature || !publicKey) return NextResponse.json({ error: "Missing judge, vote, signature, or publicKey" }, { status: 400 });
  if (!["MET", "NOT_MET"].includes(vote)) return NextResponse.json({ error: "Bad vote" }, { status: 400 });

  const project = await db.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Only judges invited by the builder for THIS project may attest.
  let invitedJudges: string[] = [];
  try {
    invitedJudges = JSON.parse((project as any).judges || "[]");
  } catch {
    invitedJudges = [];
  }
  if (invitedJudges.length === 0) {
    return NextResponse.json({ error: "No judges have been invited for this covenant yet." }, { status: 400 });
  }
  if (!includesAddr(invitedJudges, judge)) {
    return NextResponse.json({ error: "This address is not an invited judge for this covenant." }, { status: 403 });
  }

  // Cryptographically verify the vote was signed by the wallet that owns `judge`.
  // The message is reconstructed server-side so a client can't sign a different one.
  const message = `Covenant ${id} milestone: ${vote}`;
  let signatureValid = false;
  try {
    signatureValid = verifyMessageSignatureRsv({ message, signature, publicKey });
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });
  }
  let signerAddress = "";
  try {
    signerAddress = getAddressFromPublicKey(publicKey, FLOWVAULT_NETWORK);
  } catch {
    signerAddress = "";
  }
  if (!eqAddr(signerAddress, judge)) {
    return NextResponse.json({ error: "The signature does not match the invited judge's address." }, { status: 401 });
  }

  const threshold = Math.min(2, invitedJudges.length);

  // Upsert attestation (store the verified signature).
  await db.judgeAttestation.upsert({
    where: { projectId_judge: { projectId: id, judge } },
    create: { projectId: id, judge, vote, signature },
    update: { vote, signature },
  });

  // Auto advance once the MET threshold (2-of-N) is reached. Only count votes
  // from currently-invited judges.
  const atts = await db.judgeAttestation.findMany({ where: { projectId: id } });
  const metCount = atts.filter(a => a.vote === "MET" && includesAddr(invitedJudges, a.judge)).length;

  if (metCount >= threshold && !["POOLED_LOCKED", "DISPUTE_WINDOW", "RESOLVED_SUCCESS"].includes(project.status)) {
    await db.project.update({ where: { id }, data: { status: "DISPUTE_WINDOW" } });
    await db.projectStateLog.create({ data: { projectId: id, status: "DISPUTE_WINDOW", note: `${metCount}-of-${invitedJudges.length} judges attested MET` } });
  }

  return NextResponse.json({ ok: true, metCount, threshold, totalJudges: invitedJudges.length });
}
