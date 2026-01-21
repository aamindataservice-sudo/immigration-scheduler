import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSchedule } from "@/lib/scheduling";
import { getMogadishuNowParts, getMogadishuTomorrowISO } from "@/lib/time";

export async function POST() {
  try {
    const setting = await prisma.autoScheduleSetting.findFirst();
    const autoTime24 = setting?.autoTime24 ?? "19:00";
    const [autoH, autoM] = autoTime24.split(":").map((v) => parseInt(v, 10));

    const parts = getMogadishuNowParts();
    const now = new Date(parts.isoLocal);
    const todayTarget = new Date(
      `${parts.year}-${parts.month}-${parts.day}T${String(autoH).padStart(2, "0")}:${String(autoM).padStart(2, "0")}:00+03:00`
    );

    if (now.getTime() < todayTarget.getTime()) {
      return NextResponse.json({ ok: true, ran: false, reason: "Before auto time" });
    }

    const dateISO = getMogadishuTomorrowISO();

    const existing = await prisma.shift.findFirst({
      where: { date: new Date(dateISO) },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, ran: false, reason: "Schedule exists", date: dateISO });
    }

    const result = await generateSchedule(dateISO);
    return NextResponse.json({ ok: true, ran: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
