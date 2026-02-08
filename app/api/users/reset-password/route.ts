import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ensureRolePolicies, logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requesterId = String(body?.requesterId ?? "").trim();
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }
    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const ids = Array.isArray(body?.ids) ? body.ids : body?.id ? [body.id] : [];
    if (!ids.length) {
      return NextResponse.json({ ok: false, error: "User id(s) required" }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, role: true },
    });
    if (!users.length) {
      return NextResponse.json({ ok: false, error: "Users not found" }, { status: 404 });
    }

    await ensureRolePolicies();
    const privilege = await prisma.userPrivilege.findUnique({ where: { userId: requesterId } });
    if (requester.role !== "SUPER_ADMIN") {
      if (!privilege?.canResetPassword) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
      }
      for (const u of users) {
        const policy = await prisma.roleCreationPolicy.findUnique({ where: { role: u.role } });
        if (!policy?.allowPasswordReset) {
          return NextResponse.json({ ok: false, error: "Password reset not allowed for this role" }, { status: 403 });
        }
      }
    }

    const updates = users.map((u) => {
      const password = u.role === "ADMIN" ? "admin123" : "officer123";
      return prisma.user.update({
        where: { id: u.id },
        data: {
          passwordHash: hashPassword(password),
          mustChangePassword: true,
        },
      });
    });
    await prisma.$transaction(updates);
    await logAudit({
      actorId: requester.id,
      action: "user.reset_password",
      metadata: { count: updates.length },
    });

    return NextResponse.json({ ok: true, count: updates.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
