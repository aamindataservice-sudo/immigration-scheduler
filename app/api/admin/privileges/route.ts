import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureUserPrivileges, logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requesterId = searchParams.get("requesterId") ?? "";
  if (!requesterId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  const requester = await prisma.user.findUnique({ where: { id: requesterId } });
  if (!requester || requester.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, role: true },
  });
  // Ensure every user has a privilege row so UI always has real data
  for (const u of users) {
    await ensureUserPrivileges(u.id, u.role);
  }
  const privileges = await prisma.userPrivilege.findMany();
  return NextResponse.json({ ok: true, users, privileges });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requesterId: string = body?.requesterId ?? "";
    const userId: string = body?.userId ?? "";
    const updates = body?.privileges ?? {};

    if (!requesterId || !userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }
    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    await ensureUserPrivileges(userId, target.role);
    const privilege = await prisma.userPrivilege.update({
      where: { userId },
      data: { ...updates },
    });

    await logAudit({
      actorId: requesterId,
      action: "privilege.update",
      targetType: "User",
      targetId: userId,
      metadata: updates,
    });

    return NextResponse.json({ ok: true, privilege });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
