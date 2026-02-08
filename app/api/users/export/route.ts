import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requesterId = searchParams.get("requesterId") ?? "";
  if (!requesterId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }
  const requester = await prisma.user.findUnique({ where: { id: requesterId } });
  if (!requester || requester.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { fullName: "asc" },
    select: { fullName: true, phone: true, role: true, isActive: true, createdAt: true },
  });

  const header = "fullName,phone,role,isActive,createdAt";
  const rows = users.map((u) =>
    [
      `"${u.fullName.replace(/"/g, '""')}"`,
      `"${u.phone}"`,
      `"${u.role}"`,
      u.isActive ? "true" : "false",
      u.createdAt.toISOString(),
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="users.csv"',
    },
  });
}
