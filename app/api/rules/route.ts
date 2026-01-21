import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date = String(body?.date ?? "");
    const morningLimit = Number(body?.morningLimit ?? -1);
    const afternoonLimit = Number(body?.afternoonLimit ?? -1);
    if (!date || morningLimit < 0 || afternoonLimit < 0) {
      return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }
    const rule = await prisma.shiftRule.upsert({
      where: { date: new Date(date) },
      update: { morningLimit, afternoonLimit },
      create: { date: new Date(date), morningLimit, afternoonLimit },
    });
    return NextResponse.json({ ok: true, rule });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
