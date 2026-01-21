import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId ?? "");
    const startDate = String(body?.startDate ?? "");
    const endDate = String(body?.endDate ?? "");
    const status = String(body?.status ?? "APPROVED");
    if (!userId || !startDate || !endDate) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }
    const row = await prisma.vacationRequest.create({
      data: {
        userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status,
      },
    });
    return NextResponse.json({ ok: true, vacation: row });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
