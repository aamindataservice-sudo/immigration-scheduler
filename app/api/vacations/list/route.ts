import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.vacationRequest.findMany({
      include: { user: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, vacations: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
