import { NextResponse } from "next/server";
import { getAvailableOfficers } from "@/lib/scheduling";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ ok: false, error: "Date required" }, { status: 400 });
    }
    const available = await getAvailableOfficers(date);
    return NextResponse.json({ 
      ok: true, 
      count: available.length,
      officers: available.map(u => ({ id: u.id, fullName: u.fullName }))
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
