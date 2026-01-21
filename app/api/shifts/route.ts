import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSchedule } from "@/lib/scheduling";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ ok: false, error: "Date required" }, { status: 400 });
    }
    const shifts = await prisma.shift.findMany({
      where: { date: new Date(date) },
      include: { user: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { type: "asc" },
    });
    return NextResponse.json({ ok: true, shifts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date = String(body?.date ?? "");
    if (!date) {
      return NextResponse.json({ ok: false, error: "Date required" }, { status: 400 });
    }
    const result = await generateSchedule(date);
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const date = String(body?.date ?? "");
    if (!date) {
      return NextResponse.json({ ok: false, error: "Date required" }, { status: 400 });
    }
    await prisma.shift.deleteMany({ where: { date: new Date(date) } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
