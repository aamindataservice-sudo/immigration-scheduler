import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requesterId = String(body?.requesterId ?? "").trim();
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }
    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const id = String(body?.id ?? body?.userId ?? "");
    if (!id) {
      return NextResponse.json({ ok: false, error: "User id required" }, { status: 400 });
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }
    if (target.role === "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Cannot delete Super Admin" }, { status: 403 });
    }
    if (requester.role !== "SUPER_ADMIN") {
      const privilege = await prisma.userPrivilege.findUnique({ where: { userId: requesterId } });
      if (!privilege?.canDeleteUser) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
      }
      const policy = await prisma.roleCreationPolicy.findUnique({ where: { role: target.role as any } });
      if (!policy?.allowDelete) {
        return NextResponse.json({ ok: false, error: "Delete not allowed for this role" }, { status: 403 });
      }
    }

    await prisma.user.delete({ where: { id } });

    await logAudit({
      actorId: requester.id,
      action: "user.delete",
      targetType: "User",
      targetId: id,
      metadata: { role: target.role },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
