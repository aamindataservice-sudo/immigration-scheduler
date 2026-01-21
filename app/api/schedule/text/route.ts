import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatMogadishuDate } from "@/lib/time";

const label: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  FULLTIME: "Full Time",
  DAYOFF: "Day Off",
  VACATION: "Vacation",
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const mode = searchParams.get("mode") || "full";
    if (!date) {
      return NextResponse.json({ ok: false, error: "Date required" }, { status: 400 });
    }
    const shifts = await prisma.shift.findMany({
      where: { date: new Date(date) },
      include: { user: { select: { fullName: true } } },
      orderBy: { type: "asc" },
    });
    const grouped: Record<string, string[]> = {};
    for (const shift of shifts) {
      const name = shift.user?.fullName ?? "Unknown";
      if (!grouped[shift.type]) grouped[shift.type] = [];
      grouped[shift.type].push(name);
    }

    let lines: string[] = [];
    if (mode === "dayoff") {
      const list = grouped.DAYOFF ?? [];
      lines = [
        `🏠 Day Off - ${date}`,
        "",
        `Day Off (${list.length})`,
        list.length ? list.map((n, i) => `${i + 1}. ${n}`).join("\n") : "- None",
        "",
        `_Generated: ${formatMogadishuDate(new Date(), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}_`,
      ];
    } else {
      lines = [
        `📅 Schedule - ${date}`,
        "",
        ...Object.keys(label).map((key) => {
          const list = grouped[key] ?? [];
          const header = `${label[key]} (${list.length})`;
          if (list.length === 0) {
            return `${header}\n- None`;
          }
          return `${header}\n${list.map((n, i) => `${i + 1}. ${n}`).join("\n")}`;
        }),
        "",
        `_Generated: ${formatMogadishuDate(new Date(), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}_`,
      ];
    }
    return NextResponse.json({ ok: true, text: lines.join("\n") });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
