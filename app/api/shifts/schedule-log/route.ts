import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ ok: false, error: "Date required" }, { status: 400 });
    }
    
    const log = await prisma.scheduleLog.findUnique({
      where: { date: new Date(date) },
    });
    
    if (!log) {
      return NextResponse.json({ ok: true, log: null });
    }
    
    return NextResponse.json({ 
      ok: true, 
      log: {
        date: log.date.toISOString().split("T")[0],
        isAuto: log.isAuto,
        createdAt: log.createdAt.toISOString(),
      }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
