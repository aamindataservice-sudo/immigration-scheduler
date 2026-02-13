import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatMogadishuDate } from "@/lib/time";

const shiftConfig: { key: string; label: string; emoji: string }[] = [
  { key: "MORNING", label: "Morning Shift", emoji: "🌅" },
  { key: "AFTERNOON", label: "Afternoon Shift", emoji: "🌇" },
  { key: "FULLTIME", label: "Full Time", emoji: "⏰" },
  { key: "DAYOFF", label: "Day Off", emoji: "🏠" },
  { key: "VACATION", label: "Vacation", emoji: "🏖️" },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SOMALI = ["Axad", "Isniin", "Talaado", "Arbaco", "Khamiis", "Jimco", "Sabti"];

// Fun greetings based on time of day
function getGreeting(): string {
  const hour = new Date().toLocaleString("en-US", { timeZone: "Africa/Mogadishu", hour: "numeric", hour12: false });
  const h = parseInt(hour);
  if (h < 12) return "Subax wanaagsan! ☀️";
  if (h < 17) return "Galab wanaagsan! 🌤️";
  return "Fiid wanaagsan! 🌙";
}

// Get day name in both languages
function getDayName(date: Date): string {
  const dayIndex = date.getDay();
  return `${DAYS[dayIndex]} (${DAYS_SOMALI[dayIndex]})`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const mode = searchParams.get("mode") || "full";
    if (!date) {
      return NextResponse.json({ ok: false, error: "Date required" }, { status: 400 });
    }

    const timestamp = formatMogadishuDate(new Date(), { 
      hour: "2-digit", minute: "2-digit", hour12: true
    });
    const dateObj = new Date(date);
    const dayName = getDayName(dateObj);
    const greeting = getGreeting();

    let lines: string[] = [];
    
    if (mode === "dayoff") {
      // Weekly day-off from patterns (not daily shifts)
      const dayOffPatterns = await prisma.weeklyDayOffPattern.findMany({
        where: { isActive: true },
        include: { user: { select: { fullName: true, isActive: true } } },
        orderBy: { dayOfWeek: "asc" },
      });
      
      // Group by day of week
      const byDay: Record<number, string[]> = {};
      for (let i = 0; i < 7; i++) byDay[i] = [];
      
      for (const p of dayOffPatterns) {
        if (p.user?.isActive) {
          byDay[p.dayOfWeek].push(p.user.fullName);
        }
      }
      
      const sections: string[] = [];
      for (let i = 0; i < 7; i++) {
        const list = byDay[i];
        if (list.length > 0) {
          sections.push(`📍 *${DAYS[i]}* _(${DAYS_SOMALI[i]})_ — ${list.length} officers`);
          sections.push(...list.map((n, idx) => `    ${idx + 1}. ${n}`));
          sections.push(``);
        }
      }
      
      const totalOff = dayOffPatterns.filter(p => p.user?.isActive).length;
      
      lines = [
        `🏠 *WEEKLY DAY-OFF SCHEDULE*`,
        `_Jadwalka Maalinta Fasaxa_`,
        ``,
        `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔`,
        ``,
        ...(sections.length > 0 ? sections : [`_No day-off patterns configured_`, ``]),
        `▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁`,
        ``,
        `📊 *Total:* ${totalOff} officers with scheduled day-off`,
        ``,
        `_Generated at ${timestamp} 🕐_`,
        ``,
        `🛫 _International Arrival System_`,
      ];
    } else {
      // Daily schedule
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
      // Build sections only for non-zero shifts
      const sections: string[] = [];
      let totalWorking = 0;
      let totalOff = 0;

      for (const { key, label, emoji } of shiftConfig) {
        const list = grouped[key] ?? [];
        if (list.length > 0) {
          sections.push(`${emoji} *${label.toUpperCase()}* — ${list.length} officers`);
          sections.push(...list.map((n, i) => `    ${i + 1}. ${n}`));
          sections.push(``);
          
          if (key === "DAYOFF" || key === "VACATION") {
            totalOff += list.length;
          } else {
            totalWorking += list.length;
          }
        }
      }

      lines = [
        `${greeting}`,
        ``,
        `🇸🇴 *IMMIGRATION DAILY SCHEDULE*`,
        `_Jadwalka Maalmeed ee Socdaalka_`,
        ``,
        `📅 *${dayName}*`,
        `📆 ${date}`,
        ``,
        `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔`,
        ``,
        ...sections,
        `▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁`,
        ``,
        `📊 *SUMMARY / KOOBAN*`,
        `├ ✅ Working: *${totalWorking}* officers`,
        `├ 🏠 Off: *${totalOff}* officers`,
        `└ 👥 Total: *${shifts.length}* officers`,
        ``,
        `_Generated at ${timestamp} 🕐_`,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `🛫 _International Arrival System_`,
        `_Soo dhoweynta & Adeegga Wanaagsan!_ ✨`,
      ];
    }
    return NextResponse.json({ ok: true, text: lines.join("\n") });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
