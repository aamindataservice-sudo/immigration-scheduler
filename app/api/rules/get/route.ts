import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableOfficers } from "@/lib/scheduling";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ ok: false, error: "Date required" }, { status: 400 });
    }
    
    // Check if rule already exists in database
    const existingRule = await prisma.shiftRule.findUnique({
      where: { date: new Date(date) },
    });
    
    if (existingRule) {
      // Return the manually set rule
      return NextResponse.json({ 
        ok: true, 
        rule: existingRule, 
        isManual: true 
      });
    }
    
    // Calculate default rule (don't save it yet - only save when admin clicks Save Rule or when generating)
    const available = await getAvailableOfficers(date);
    const morningLimit = Math.ceil((available.length * 3) / 5);
    const afternoonLimit = Math.max(available.length - morningLimit, 0);
    
    return NextResponse.json({ 
      ok: true, 
      rule: { morningLimit, afternoonLimit },
      isManual: false 
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
