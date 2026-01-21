import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fullName = String(body?.fullName ?? "").trim();
    const phone = normalizePhone(body?.phone ?? "");
    const role = body?.role === "ADMIN" ? "ADMIN" : "OFFICER";
    const password = String(body?.password ?? "").trim();
    const defaultPassword = role === "ADMIN" ? "admin123" : "officer123";
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

    const user = await prisma.user.create({
      data: {
        fullName,
        phone,
        role,
        passwordHash: hashPassword(finalPassword),
        mustChangePassword: true,
      },
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
