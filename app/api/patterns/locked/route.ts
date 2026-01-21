import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ShiftType } from "@prisma/client";

export async function GET() {
  try {
    const patterns = await prisma.weeklyLockedShiftPattern.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { userId: "asc" }],
    });
    return NextResponse.json({ ok: true, patterns });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId ?? "");
    const dayOfWeek = Number(body?.dayOfWeek ?? -1);
    const shiftType = String(body?.shiftType ?? "");
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : true;

    if (!userId || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }
    const allowed = ["MORNING", "AFTERNOON", "FULLTIME"] as const;
    if (!allowed.includes(shiftType as (typeof allowed)[number])) {
      return NextResponse.json({ ok: false, error: "Invalid shift type" }, { status: 400 });
    }

    const pattern = await prisma.weeklyLockedShiftPattern.upsert({
      where: { userId_dayOfWeek_shiftType: { userId, dayOfWeek, shiftType: shiftType as ShiftType } },
      update: { isActive },
      create: { userId, dayOfWeek, shiftType: shiftType as ShiftType, isActive },
    });
    return NextResponse.json({ ok: true, pattern });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId ?? "");
    const dayOfWeek = Number(body?.dayOfWeek ?? -1);
    const shiftType = String(body?.shiftType ?? "");
    if (!userId || dayOfWeek < 0 || dayOfWeek > 6 || !shiftType) {
      return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }
    await prisma.weeklyLockedShiftPattern.delete({
      where: { userId_dayOfWeek_shiftType: { userId, dayOfWeek, shiftType: shiftType as ShiftType } },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
