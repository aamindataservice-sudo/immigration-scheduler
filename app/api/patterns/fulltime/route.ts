import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const patterns = await prisma.weeklyFullTimePattern.findMany({
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
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : true;

    if (!userId || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }

    const pattern = await prisma.weeklyFullTimePattern.upsert({
      where: { userId_dayOfWeek: { userId, dayOfWeek } },
      update: { isActive },
      create: { userId, dayOfWeek, isActive },
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
    if (!userId || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }
    await prisma.weeklyFullTimePattern.delete({
      where: { userId_dayOfWeek: { userId, dayOfWeek } },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
