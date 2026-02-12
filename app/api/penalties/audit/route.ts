import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET: Penalty audit history for checker (only their own PENALTY_* actions) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get("requesterId") ?? "";

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

    const where =
      requester.role === "CHECKER"
        ? { actorId: requesterId, action: { startsWith: "PENALTY_" } }
        : { action: { startsWith: "PENALTY_" } };

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { id: true, fullName: true, role: true } } },
    });

    return NextResponse.json({ ok: true, logs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

/** DELETE: Clear all penalty audit history for this checker */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get("requesterId") ?? "";

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

    const where =
      requester.role === "CHECKER"
        ? { actorId: requesterId, action: { startsWith: "PENALTY_" } }
        : { action: { startsWith: "PENALTY_" } };

    await prisma.auditLog.deleteMany({ where });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
