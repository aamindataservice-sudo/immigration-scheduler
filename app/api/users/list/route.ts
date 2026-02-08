import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get("requesterId") ?? "";
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });
    if (!requester) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    let whereClause: any = {};
    const privilege = await prisma.userPrivilege.findUnique({ where: { userId: requesterId } });

    if (requester.role === "ADMIN") {
      whereClause = {
        role: {
          in: ["ADMIN", "OFFICER", "CHECKER"],
        },
      };
    } else if (requester.role !== "SUPER_ADMIN") {
      if (!privilege?.canCreateUser && !privilege?.canUpdateUser && !privilege?.canViewReports) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ ok: true, users });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
