import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeRule } from "@/lib/scheduling";
import { getMogadishuNowParts, getMogadishuTomorrowISO } from "@/lib/time";
import { ShiftType } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId ?? "");
    const date = String(body?.date ?? "");
    const choice = String(body?.choice ?? "");

    if (!userId || !date) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }
    const allowed = ["MORNING", "AFTERNOON"] as const;
    if (!allowed.includes(choice as (typeof allowed)[number])) {
      return NextResponse.json({ ok: false, error: "Invalid choice" }, { status: 400 });
    }

    const existingSchedule = await prisma.shift.findFirst({
      where: { date: new Date(date) },
      select: { id: true },
    });
    if (existingSchedule) {
      return NextResponse.json({ ok: false, error: "Schedule already generated" }, { status: 400 });
    }

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
      return NextResponse.json({ ok: false, error: "Choices closed after auto time" }, { status: 400 });
    }

    const dayOfWeek = new Date(date).getUTCDay();
    const blocked = await Promise.all([
      prisma.weeklyDayOffPattern.findFirst({ where: { userId, dayOfWeek, isActive: true } }),
      prisma.weeklyFullTimePattern.findFirst({ where: { userId, dayOfWeek, isActive: true } }),
      prisma.weeklyLockedShiftPattern.findFirst({ where: { userId, dayOfWeek, isActive: true } }),
      prisma.vacationRequest.findFirst({
        where: {
          userId,
          status: "APPROVED",
          startDate: { lte: new Date(date) },
          endDate: { gte: new Date(date) },
        },
      }),
    ]);
    if (blocked.some(Boolean)) {
      return NextResponse.json({ ok: false, error: "You are locked for this day" }, { status: 400 });
    }

    let ensuredRule = await prisma.shiftRule.findUnique({ where: { date: new Date(date) } });
    if (!ensuredRule) {
      const computed = await computeRule(date);
      ensuredRule = computed.rule;
    }

    const choices = await prisma.shiftChoice.findMany({ where: { date: new Date(date) } });
    const morningCount = choices.filter((c) => c.choice === ShiftType.MORNING).length;
    const afternoonCount = choices.filter((c) => c.choice === ShiftType.AFTERNOON).length;

    if (choice === ShiftType.MORNING && morningCount >= ensuredRule.morningLimit) {
      return NextResponse.json({ ok: false, error: "Morning quota full" }, { status: 400 });
    }
    if (choice === ShiftType.AFTERNOON && afternoonCount >= ensuredRule.afternoonLimit) {
      return NextResponse.json({ ok: false, error: "Afternoon quota full" }, { status: 400 });
    }

    const saved = await prisma.shiftChoice.upsert({
      where: { userId_date: { userId, date: new Date(date) } },
      update: { choice: choice as ShiftType },
      create: { userId, date: new Date(date), choice: choice as ShiftType },
    });
    return NextResponse.json({ ok: true, choice: saved });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
