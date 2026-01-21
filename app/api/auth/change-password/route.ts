import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId ?? "");
    const currentPassword = body?.currentPassword ? String(body.currentPassword) : "";
    const newPassword = String(body?.newPassword ?? "");

    if (!userId || !newPassword || newPassword.length < 3) {
      return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    if (currentPassword) {
      const valid = verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ ok: false, error: "Current password incorrect" }, { status: 400 });
      }
    } else if (!user.mustChangePassword) {
      return NextResponse.json({ ok: false, error: "Current password required" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(newPassword), mustChangePassword: false },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        fullName: updated.fullName,
        phone: updated.phone,
        role: updated.role,
        mustChangePassword: updated.mustChangePassword,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
