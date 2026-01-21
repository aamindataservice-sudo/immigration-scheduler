import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const date = searchParams.get("date");
    if (!userId || !date) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }
    const shift = await prisma.shift.findFirst({
      where: { userId, date: new Date(date) },
    });
    return NextResponse.json({ ok: true, shift: shift ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
