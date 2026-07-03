import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { eqAddr } from "@/src/lib/address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Returns everything relevant to one wallet under the grant model:
// programs they created (grantor), programs they applied to / are building
// (builder), and programs where they are a named judge.
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") || "";
  if (!address) return NextResponse.json({ asGrantor: [], asBuilder: [], asJudge: [] });

  const db = getDb();
  const programs = await db.grantProgram
    .findMany({
      orderBy: { createdAt: "desc" },
      include: {
        applications: true,
        award: { include: { milestones: { orderBy: { index: "asc" } }, distributions: true } },
      },
    })
    .catch(() => [] as any[]);

  const shape = (p: any) => {
    let judges: string[] = [];
    try {
      judges = JSON.parse(p.award?.judges || "[]");
    } catch {
      judges = [];
    }
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      totalPool: p.totalPool,
      grantorAddress: p.grantorAddress,
      custodianAddress: p.custodianAddress,
      programDeadlineAt: p.programDeadlineAt,
      programDeadlineBlock: p.programDeadlineBlock,
      fundExplorerUrl: p.fundExplorerUrl,
      lockExplorerUrl: p.lockExplorerUrl,
      applicationCount: p.applications.length,
      judges,
      award: p.award
        ? {
            id: p.award.id,
            builderAddress: p.award.builderAddress,
            amount: p.award.amount,
            status: p.award.status,
            activeMilestoneIndex: p.award.activeMilestoneIndex,
            milestones: p.award.milestones.map((m: any) => ({
              index: m.index,
              name: m.name,
              deadlineBlock: m.deadlineBlock,
              deadlineAt: m.deadlineAt,
              percentBps: m.percentBps,
              amount: m.amount,
              status: m.status,
              payoutExplorerUrl: m.payoutExplorerUrl,
            })),
          }
        : null,
    };
  };

  const asGrantor = programs.filter((p: any) => eqAddr(p.grantorAddress, address)).map(shape);

  const asBuilder = programs
    .filter(
      (p: any) =>
        p.applications.some((a: any) => eqAddr(a.builderAddress, address)) ||
        (p.award && eqAddr(p.award.builderAddress, address))
    )
    .map((p: any) => {
      const base = shape(p);
      const myApp = p.applications.find((a: any) => eqAddr(a.builderAddress, address));
      return { ...base, myApplicationStatus: myApp?.status ?? null };
    });

  const asJudge = programs
    .filter((p: any) => {
      let judges: string[] = [];
      try {
        judges = JSON.parse(p.award?.judges || "[]");
      } catch {
        judges = [];
      }
      return judges.some((j) => eqAddr(j, address));
    })
    .map(shape);

  return NextResponse.json({ asGrantor, asBuilder, asJudge });
}
