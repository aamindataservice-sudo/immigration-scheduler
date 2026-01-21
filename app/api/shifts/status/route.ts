import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMogadishuNowParts, getMogadishuTomorrowISO } from "@/lib/time";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ ok: false, error: "Date required" }, { status: 400 });
    }
    const count = await prisma.shift.count({ where: { date: new Date(date) } });
    const exists = count > 0;
    let choicesOpen = !exists;
    let reason: string | null = exists ? "schedule-generated" : null;

    const setting = await prisma.autoScheduleSetting.findFirst();
    const autoTime24 = setting?.autoTime24 ?? "19:00";
    const parts = getMogadishuNowParts();
    const now = new Date(parts.isoLocal);
    const [autoH, autoM] = autoTime24.split(":").map((v) => parseInt(v, 10));
    const cutoff = new Date(
      `${parts.year}-${parts.month}-${parts.day}T${String(autoH).padStart(2, "0")}:${String(autoM).padStart(2, "0")}:00+03:00`
    );
    const tomorrowISO = getMogadishuTomorrowISO();
    if (date === tomorrowISO && now.getTime() >= cutoff.getTime()) {
      choicesOpen = false;
      reason = "cutoff-passed";
    }

    return NextResponse.json({ ok: true, exists, count, choicesOpen, reason });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
