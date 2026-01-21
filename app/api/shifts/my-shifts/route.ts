import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UserId required" }, { status: 400 });
    }
    const shifts = await prisma.shift.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 14,
    });
    return NextResponse.json({ ok: true, shifts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
