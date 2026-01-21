import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = normalizePhone(body?.phone ?? "");
    const password = String(body?.password ?? "");

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

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
