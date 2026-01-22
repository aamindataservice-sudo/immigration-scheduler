import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    
    if (!phone) {
      return NextResponse.json({ ok: false, error: "Phone required" }, { status: 400 });
    }
    
    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    });
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }
    
    if (!user.isActive) {
      return NextResponse.json({ ok: false, error: "Account is inactive" }, { status: 403 });
    }
    
    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
