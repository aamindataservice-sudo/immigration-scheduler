import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { ensureRolePolicies, ensureUserPrivileges, logAudit } from "@/lib/audit";

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

    const fullName = String(body?.fullName ?? "").trim();
    const phone = normalizePhone(body?.phone ?? "");
    const requestedRole = String(body?.role ?? "").toUpperCase();
    const role =
      requestedRole === "SUPER_ADMIN"
        ? "SUPER_ADMIN"
        : requestedRole === "ADMIN"
        ? "ADMIN"
        : requestedRole === "CHECKER"
        ? "CHECKER"
        : "OFFICER";
    const password = String(body?.password ?? "").trim();
    const defaultPassword = role === "ADMIN" ? "admin123" : role === "CHECKER" ? "checker123" : "officer123";
    const finalPassword = password || defaultPassword;

    if (!fullName) {
      return NextResponse.json({ ok: false, error: "Full name required" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ ok: false, error: "Phone must be 252 + 9 digits" }, { status: 400 });
    }
    if (!finalPassword || finalPassword.length < 3) {
      return NextResponse.json({ ok: false, error: "Password required" }, { status: 400 });
    }

    // Super Admin bypasses all checks; others must obey policy and cannot create Super Admin
    if (role === "SUPER_ADMIN" && requester.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Only Super Admin can create Super Admin" }, { status: 403 });
    }

    if (requester.role !== "SUPER_ADMIN") {
      const privilege = await prisma.userPrivilege.findUnique({ where: { userId: requesterId } });
      if (!privilege?.canCreateUser) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
      }
      await ensureRolePolicies();
      const policy = await prisma.roleCreationPolicy.findUnique({ where: { role } });
      if (!policy?.isAllowed) {
        return NextResponse.json({ ok: false, error: `Role ${role} creation is not allowed` }, { status: 403 });
      }
    }

    const user = await prisma.user.create({
      data: {
        fullName,
        phone,
        role,
        passwordHash: hashPassword(finalPassword),
        mustChangePassword: true,
        createdBy: requester.id,
      },
    });
    await ensureUserPrivileges(user.id, role);

    await logAudit({
      actorId: requester.id,
      action: "user.create",
      targetType: "User",
      targetId: user.id,
      metadata: { role, phone },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
