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
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { id: true, fullName: true, phone: true, role: true } } },
  });

  return NextResponse.json({ ok: true, logs });
}
