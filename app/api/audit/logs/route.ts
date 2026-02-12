import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requesterId = searchParams.get("requesterId") ?? "";
  if (!requesterId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }
  const requester = await prisma.user.findUnique({ where: { id: requesterId } });
  if (!requester || requester.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);
  const userId = searchParams.get("userId") ?? "";
  const role = searchParams.get("role") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const where: Record<string, unknown> = {};

  if (userId) where.actorId = userId;
  if (role) where.actor = { role: role as "SUPER_ADMIN" | "ADMIN" | "CHECKER" | "OFFICER" };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(dateFrom + "T00:00:00.000Z");
    if (dateTo) (where.createdAt as Record<string, Date>).lte = new Date(dateTo + "T23:59:59.999Z");
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { id: true, fullName: true, phone: true, role: true } } },
  });

  return NextResponse.json({ ok: true, logs });
}
