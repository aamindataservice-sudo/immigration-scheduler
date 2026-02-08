import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureUserPrivileges } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requesterId = String(body?.requesterId ?? "");
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }
    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester || requester.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const users = await prisma.user.findMany();
    let count = 0;
    for (const user of users) {
      await ensureUserPrivileges(user.id, user.role);
      count++;
    }

    return NextResponse.json({ ok: true, count, message: `Initialized privileges for ${count} users` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
