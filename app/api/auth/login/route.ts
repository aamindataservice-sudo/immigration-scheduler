import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionToken } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { logAudit } from "@/lib/audit";
import { isRestrictedRole } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = normalizePhone(body?.phone ?? "");
    const password = String(body?.password ?? "");
    const deviceId = (body?.deviceId ?? "").trim() || null;

    if (!phone) {
      return NextResponse.json({ ok: false, error: "Invalid phone number" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ ok: false, error: "Password required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }
    if (!user.isActive) {
      return NextResponse.json({ ok: false, error: "User inactive" }, { status: 403 });
    }

    let sessionToken: string | null = null;
    let warningCount: number | undefined;

    if (isRestrictedRole(user.role)) {
      const newToken = createSessionToken();
      const hasSessionWithThisDevice =
        deviceId != null &&
        (await prisma.userSession.findFirst({
          where: { userId: user.id, deviceId },
        }));
      const hasNoSessions = (await prisma.userSession.count({ where: { userId: user.id } })) === 0;
      const sameDevice = hasNoSessions || !!hasSessionWithThisDevice;
      if (sameDevice) {
        await prisma.userSession.create({
          data: { userId: user.id, sessionToken: newToken, deviceId },
        });
        sessionToken = newToken;
      } else {
        const nextCount = (user.differentDeviceLoginCount ?? 0) + 1;
        if (nextCount >= 5) {
          await prisma.userSession.deleteMany({ where: { userId: user.id } });
          await prisma.user.update({
            where: { id: user.id },
            data: { isActive: false, differentDeviceLoginCount: nextCount },
          });
          return NextResponse.json(
            { ok: false, error: "Account deactivated due to multiple different-device logins." },
            { status: 403 }
          );
        }
        await prisma.userSession.deleteMany({ where: { userId: user.id } });
        await prisma.userSession.create({
          data: { userId: user.id, sessionToken: newToken, deviceId },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { differentDeviceLoginCount: nextCount },
        });
        sessionToken = newToken;
        warningCount = nextCount;
      }
    }

    await logAudit({
      actorId: user.id,
      action: "LOGIN",
      targetType: "User",
      targetId: user.id,
      metadata: { role: user.role },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      ...(sessionToken != null && { sessionToken }),
      ...(warningCount != null && { warningCount }),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
