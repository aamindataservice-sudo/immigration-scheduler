import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRestrictedRole } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") ?? "";
    const sessionToken = searchParams.get("sessionToken") ?? "";
    if (!userId) {
      return NextResponse.json({ ok: true, isActive: false }, { status: 200 });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, role: true },
    });
    const isActive = user?.isActive === true;
    let sessionValid = true;
    if (user && isRestrictedRole(user.role) && sessionToken !== "") {
      const sess = await prisma.userSession.findUnique({
        where: { sessionToken },
        select: { userId: true },
      });
      sessionValid = sess?.userId === userId;
    }
    return NextResponse.json({
      ok: true,
      isActive,
      sessionValid,
    });
  } catch {
    return NextResponse.json({ ok: true, isActive: false, sessionValid: false }, { status: 200 });
  }
}
