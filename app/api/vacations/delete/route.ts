import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? "");
    
    if (!id) {
      return NextResponse.json({ ok: false, error: "Vacation ID required" }, { status: 400 });
    }

    // Delete any associated vacation shifts first
    await prisma.shift.deleteMany({
      where: {
        type: "VACATION",
        userId: (await prisma.vacationRequest.findUnique({ where: { id }, select: { userId: true } }))?.userId,
      },
    });

    // Delete the vacation request
    await prisma.vacationRequest.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
