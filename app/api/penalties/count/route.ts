import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequesterForRestrictedApi } from "@/lib/session";

/** GET: Total penalty (stamp) count for checker menu card */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterIdParam = searchParams.get("requesterId") ?? "";

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

    const where = requester.role === "CHECKER" ? { createdBy: requester.id } : {};
    const count = await prisma.officerPenalty.count({ where });

    return NextResponse.json({ ok: true, count });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
