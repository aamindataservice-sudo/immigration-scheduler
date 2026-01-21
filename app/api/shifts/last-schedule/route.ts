import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Find the most recent shift (latest date with shifts)
    const lastShift = await prisma.shift.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (!lastShift) {
      return NextResponse.json({ ok: true, date: null });
    }

    // Format the date as YYYY-MM-DD
    const dateStr = lastShift.date.toISOString().slice(0, 10);
    
    return NextResponse.json({ ok: true, date: dateStr });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
