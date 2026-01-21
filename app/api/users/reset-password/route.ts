import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
    return NextResponse.json({ ok: true, count: updates.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
