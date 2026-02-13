import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") ?? "";
    if (!userId) {
      return NextResponse.json({ ok: true, isActive: false }, { status: 200 });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    return NextResponse.json({
      ok: true,
      isActive: user?.isActive === true,
    });
  } catch {
    return NextResponse.json({ ok: true, isActive: false }, { status: 200 });
  }
}
