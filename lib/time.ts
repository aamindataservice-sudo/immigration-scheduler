export const MOGADISHU_TZ = "Africa/Mogadishu";

export function formatMogadishuDate(date: Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MOGADISHU_TZ,
    ...options,
  }).format(date);
}

export function getMogadishuNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MOGADISHU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    isoLocal: `${year}-${month}-${day}T${hour}:${minute}:${second}+03:00`,
  };
}

export function getMogadishuTodayISO() {
  const parts = getMogadishuNowParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatMogadishuISODate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MOGADISHU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getMogadishuTomorrowISO() {
  const parts = getMogadishuNowParts();
  const today = new Date(parts.isoLocal);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return formatMogadishuISODate(tomorrow);
}

export function getNextAutoScheduleCountdown(autoTime24: string) {
  const { year, month, day, isoLocal } = getMogadishuNowParts();
  const now = new Date(isoLocal);
  const [h, m] = autoTime24.split(":").map((v) => parseInt(v, 10));
  const targetToday = new Date(`${year}-${month}-${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+03:00`);
  const target = now.getTime() >= targetToday.getTime()
    ? new Date(targetToday.getTime() + 24 * 60 * 60 * 1000)
    : targetToday;
  const diff = Math.max(0, target.getTime() - now.getTime());
  const hh = Math.floor(diff / 3600000);
  const mm = Math.floor((diff % 3600000) / 60000);
  const ss = Math.floor((diff % 60000) / 1000);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
