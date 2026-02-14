import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/auth";
import { isRestrictedRole } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = (body?.phone ?? "").trim();
    const deviceId = (body?.deviceId ?? "").trim() || null;

    if (!phone) {
      return NextResponse.json({ ok: false, error: "Phone required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        differentDeviceLoginCount: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json({ ok: false, error: "Account is inactive" }, { status: 403 });
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
      ...(sessionToken != null && { sessionToken }),
      ...(warningCount != null && { warningCount }),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
