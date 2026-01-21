import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? "");
    const fullName = body?.fullName ? String(body.fullName).trim() : undefined;
    const phone = body?.phone ? normalizePhone(body.phone) : undefined;
    const role = body?.role === "ADMIN" ? "ADMIN" : body?.role === "OFFICER" ? "OFFICER" : undefined;
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

    const data: any = {};
    if (fullName) data.fullName = fullName;
    if (phone) data.phone = phone;
    if (role) data.role = role;
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (typeof mustChangePassword === "boolean") data.mustChangePassword = mustChangePassword;
    if (password) data.passwordHash = hashPassword(password);
    if (typeof forceChange === "boolean") data.mustChangePassword = forceChange;

    const user = await prisma.user.update({ where: { id }, data });
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
