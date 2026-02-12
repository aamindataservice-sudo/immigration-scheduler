import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET: Previous daily history (snapshots) for checker's penalties. Query: requesterId, penaltyId? (optional, else all) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get("requesterId") ?? "";
    const penaltyId = searchParams.get("penaltyId") ?? "";

    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });
    if (!requester) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }
    if (requester.role !== "CHECKER" && requester.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const penaltyWhere = requester.role === "CHECKER"
      ? { createdBy: requesterId, ...(penaltyId ? { id: penaltyId } : {}) }
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
