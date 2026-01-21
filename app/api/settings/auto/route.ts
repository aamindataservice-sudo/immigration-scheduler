import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const row = await prisma.autoScheduleSetting.findFirst();
    return NextResponse.json({ ok: true, setting: row ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const autoTime24 = String(body?.autoTime24 ?? "19:00");
    if (!/^\d{2}:\d{2}$/.test(autoTime24)) {
      return NextResponse.json({ ok: false, error: "Time must be HH:MM" }, { status: 400 });
    }
    const existing = await prisma.autoScheduleSetting.findFirst();
    const setting = existing
      ? await prisma.autoScheduleSetting.update({
          where: { id: existing.id },
          data: { autoTime24 },
        })
      : await prisma.autoScheduleSetting.create({ data: { autoTime24 } });
    return NextResponse.json({ ok: true, setting });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
