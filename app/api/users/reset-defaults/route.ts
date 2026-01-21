import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, role: true },
    });

    const updates = users.map((u) => {
      const defaultPassword = u.role === "ADMIN" ? "admin123" : "officer123";
      return prisma.user.update({
        where: { id: u.id },
        data: {
          passwordHash: hashPassword(defaultPassword),
          mustChangePassword: true,
        },
      });
    });

    await prisma.$transaction(updates);

    return NextResponse.json({ ok: true, count: users.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
