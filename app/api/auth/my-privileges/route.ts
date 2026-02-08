import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureUserPrivileges } from "@/lib/audit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "User ID required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  // Ensure user has privileges
  await ensureUserPrivileges(userId, user.role);
  
  const privilege = await prisma.userPrivilege.findUnique({ where: { userId } });
  
  return NextResponse.json({
    ok: true,
    privilege: privilege || {},
  });
}
