import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequesterForRestrictedApi } from "@/lib/session";

/** GET: Previous daily history (snapshots) for checker's penalties. Query: requesterId, penaltyId? (optional, else all) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterIdParam = searchParams.get("requesterId") ?? "";
    const penaltyId = searchParams.get("penaltyId") ?? "";

    if (!requesterIdParam) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const requester = await getRequesterForRestrictedApi(req, requesterIdParam);
    if (!requester) {
      return NextResponse.json({ ok: false, error: "Unauthorized or session expired" }, { status: 403 });
    }
    if (requester.role !== "CHECKER" && requester.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const penaltyWhere = requester.role === "CHECKER"
      ? { createdBy: requester.id, ...(penaltyId ? { id: penaltyId } : {}) }
      : penaltyId ? { id: penaltyId } : {};

    const snapshots = await prisma.penaltyDaySnapshot.findMany({
      where: { officerPenalty: penaltyWhere },
      orderBy: { date: "desc" },
      take: 200,
      include: {
        officerPenalty: {
          select: { id: true, stampNo: true, note: true },
        },
      },
    });

    return NextResponse.json({ ok: true, snapshots });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
