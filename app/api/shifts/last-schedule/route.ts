import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Find the most recent schedule log
    const lastLog = await prisma.scheduleLog.findFirst({
      orderBy: { date: "desc" },
    });

    if (lastLog) {
      return NextResponse.json({ 
        ok: true, 
        date: lastLog.date.toISOString().slice(0, 10),
        isAuto: lastLog.isAuto,
        createdAt: lastLog.createdAt.toISOString(),
      });
    }

    // Fallback: find the most recent shift
    const lastShift = await prisma.shift.findFirst({
      orderBy: { date: "desc" },
      select: { date: true, createdAt: true },
    });

    if (!lastShift) {
      return NextResponse.json({ ok: true, date: null, isAuto: null });
    }

    return NextResponse.json({ 
      ok: true, 
      date: lastShift.date.toISOString().slice(0, 10),
      isAuto: null, // Unknown for old schedules
      createdAt: lastShift.createdAt.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
