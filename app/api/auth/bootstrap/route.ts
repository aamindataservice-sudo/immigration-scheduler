import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function GET() {
  try {
    const count = await prisma.user.count({ where: { role: "ADMIN" } });
    return NextResponse.json({ ok: true, hasAdmin: count > 0 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const count = await prisma.user.count({ where: { role: "ADMIN" } });
    if (count > 0) {
      return NextResponse.json({ ok: false, error: "Admin already exists" }, { status: 400 });
    }
    const body = await req.json();
    const fullName = String(body?.fullName ?? "").trim();
    const phone = normalizePhone(body?.phone ?? "");
    const password = String(body?.password ?? "").trim() || "admin123";

    if (!fullName) {
      return NextResponse.json({ ok: false, error: "Full name required" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ ok: false, error: "Phone must be 252 + 9 digits" }, { status: 400 });
    }
    if (!password || password.length < 3) {
      return NextResponse.json({ ok: false, error: "Password required" }, { status: 400 });
    }

    const admin = await prisma.user.create({
      data: {
        fullName,
        phone,
        role: "ADMIN",
        passwordHash: hashPassword(password),
        mustChangePassword: true,
      },
    });
    return NextResponse.json({
      ok: true,
      user: {
        id: admin.id,
        fullName: admin.fullName,
        phone: admin.phone,
        role: admin.role,
        mustChangePassword: admin.mustChangePassword,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
