import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { logAudit, ensureRolePolicies, ensureUserPrivileges } from "@/lib/audit";

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

    const id = String(body?.id ?? body?.userId ?? "");
    const fullName = body?.fullName ? String(body.fullName).trim() : undefined;
    const phone = body?.phone ? normalizePhone(body.phone) : undefined;
    const roleRaw = body?.role ? String(body.role).toUpperCase() : undefined;
    const role =
      roleRaw === "SUPER_ADMIN"
        ? "SUPER_ADMIN"
        : roleRaw === "ADMIN"
        ? "ADMIN"
        : roleRaw === "CHECKER"
        ? "CHECKER"
        : roleRaw === "OFFICER"
        ? "OFFICER"
        : undefined;
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : undefined;
    const password = body?.password ? String(body.password) : undefined;
    const mustChangePassword =
      typeof body?.mustChangePassword === "boolean" ? body.mustChangePassword : undefined;
    const forceChange = typeof body?.forceChange === "boolean" ? body.forceChange : undefined;

    if (!id) {
      return NextResponse.json({ ok: false, error: "User id required" }, { status: 400 });
    }
    if (body?.phone && !phone) {
      return NextResponse.json({ ok: false, error: "Phone must be 252 + 9 digits" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // Permission checks
    if (requester.role !== "SUPER_ADMIN") {
      const privilege = await prisma.userPrivilege.findUnique({ where: { userId: requesterId } });
      if (!privilege?.canUpdateUser) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
      }
      await ensureRolePolicies();
      const policy = await prisma.roleCreationPolicy.findUnique({ where: { role: targetUser.role } });
      const targetPolicyRole = await prisma.roleCreationPolicy.findUnique({ where: { role: role ?? targetUser.role } });

      if (targetUser.role === "SUPER_ADMIN") {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
      }
      if (role && (role === "SUPER_ADMIN" || role === "ADMIN")) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
      }
      if (role && (!targetPolicyRole || targetPolicyRole.isAllowed === false || targetPolicyRole.allowUpdate === false)) {
        return NextResponse.json({ ok: false, error: `Role ${role} not allowed` }, { status: 403 });
      }
      if (policy && policy.allowUpdate === false) {
        return NextResponse.json({ ok: false, error: "Updates not allowed for this role" }, { status: 403 });
      }
      if (typeof isActive === "boolean" && policy && policy.allowDeactivate === false) {
        return NextResponse.json({ ok: false, error: "Activation changes not allowed for this role" }, { status: 403 });
      }
    }

    const data: any = {};
    if (fullName) data.fullName = fullName;
    if (phone) data.phone = phone;
    if (role) data.role = role;
    if (typeof isActive === "boolean") {
      data.isActive = isActive;
      if (isActive === true) data.differentDeviceLoginCount = 0;
    }
    if (typeof mustChangePassword === "boolean") data.mustChangePassword = mustChangePassword;
    if (password) data.passwordHash = hashPassword(password);
    if (typeof forceChange === "boolean") data.mustChangePassword = forceChange;

    const user = await prisma.user.update({ where: { id }, data });
    if (role) {
      await ensureUserPrivileges(user.id, user.role);
    }

    await logAudit({
      actorId: requester.id,
      action: "user.update",
      targetType: "User",
      targetId: user.id,
      metadata: { updated: Object.keys(data) },
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
