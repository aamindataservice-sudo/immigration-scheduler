import { prisma } from "@/lib/prisma";
import { ShiftType } from "@prisma/client";

export type ScheduleResult = {
  date: string;
  morningLimit: number;
  afternoonLimit: number;
  created: number;
  available: number;
};

function shuffle<T>(arr: T[]) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Get day of week for Mogadishu timezone (correct for date-only strings)
function getDayOfWeekForDate(dateISO: string): number {
  // Parse as local date to avoid timezone issues
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDay();
}

export async function computeRule(dateISO: string) {
  const rule = await prisma.shiftRule.findUnique({
    where: { date: new Date(dateISO) },
  });
  if (rule) {
    return { rule, isDefault: false };
  }
  const available = await getAvailableOfficers(dateISO);
  const morningLimit = Math.ceil((available.length * 3) / 5);
  const afternoonLimit = Math.max(available.length - morningLimit, 0);
  const newRule = await prisma.shiftRule.create({
    data: {
      date: new Date(dateISO),
      morningLimit,
      afternoonLimit,
    },
  });
  return { rule: newRule, isDefault: true };
}

export async function getAvailableOfficers(dateISO: string) {
  const date = new Date(dateISO);
  const dayOfWeek = getDayOfWeekForDate(dateISO);
  
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true, role: "OFFICER" },
    select: { id: true, fullName: true },
  });

  const dayOff = await prisma.weeklyDayOffPattern.findMany({
    where: { dayOfWeek, isActive: true },
    select: { userId: true },
  });
  const fullTime = await prisma.weeklyFullTimePattern.findMany({
    where: { dayOfWeek, isActive: true },
    select: { userId: true },
  });
  const vacation = await prisma.vacationRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { userId: true },
  });

  const blocked = new Set([
    ...dayOff.map((d) => d.userId),
    ...fullTime.map((f) => f.userId),
    ...vacation.map((v) => v.userId),
  ]);
  return activeUsers.filter((u) => !blocked.has(u.id));
}

export async function generateSchedule(dateISO: string): Promise<ScheduleResult> {
  const date = new Date(dateISO);
  const dayOfWeek = getDayOfWeekForDate(dateISO);

  // Check if admin has manually set a rule for this date
  let rule = await prisma.shiftRule.findUnique({
    where: { date: new Date(dateISO) },
  });
  
  // If no rule exists, create one with 3/5 morning, 2/5 afternoon based on available officers
  if (!rule) {
    const available = await getAvailableOfficers(dateISO);
    const morningLimit = Math.ceil((available.length * 3) / 5);
    const afternoonLimit = Math.max(available.length - morningLimit, 0);
    rule = await prisma.shiftRule.create({
      data: { date: new Date(dateISO), morningLimit, afternoonLimit },
    });
  }
  
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true, role: "OFFICER" },
    select: { id: true },
  });

  // Get all pattern data for this day of week
  const vacation = await prisma.vacationRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { userId: true },
  });
  const locked = await prisma.weeklyLockedShiftPattern.findMany({
    where: { dayOfWeek, isActive: true },
    select: { userId: true, shiftType: true },
  });
  const dayOff = await prisma.weeklyDayOffPattern.findMany({
    where: { dayOfWeek, isActive: true },
    select: { userId: true },
  });
  const fullTime = await prisma.weeklyFullTimePattern.findMany({
    where: { dayOfWeek, isActive: true },
    select: { userId: true },
  });
  const choices = await prisma.shiftChoice.findMany({
    where: { date },
    select: { userId: true, choice: true },
  });

  const assignments = new Map<string, ShiftType>();
  const lockedUsers = new Set<string>();

  // Priority order: Vacation > Locked > DayOff > FullTime
  for (const v of vacation) {
    assignments.set(v.userId, ShiftType.VACATION);
  }

  for (const l of locked) {
    if (assignments.has(l.userId)) continue;
    assignments.set(l.userId, l.shiftType);
    lockedUsers.add(l.userId);
  }

  for (const d of dayOff) {
    if (assignments.has(d.userId)) continue;
    assignments.set(d.userId, ShiftType.DAYOFF);
  }

  for (const f of fullTime) {
    if (assignments.has(f.userId)) continue;
    assignments.set(f.userId, ShiftType.FULLTIME);
  }

  // Get remaining officers (available for morning/afternoon)
  const remaining = activeUsers
    .map((u) => u.id)
    .filter((id) => !assignments.has(id));

  const availableCount = remaining.length;

  // Get officer preferences
  const morningTargets = new Set(
    choices.filter((c) => c.choice === ShiftType.MORNING).map((c) => c.userId)
  );
  const afternoonTargets = new Set(
    choices.filter((c) => c.choice === ShiftType.AFTERNOON).map((c) => c.userId)
  );

  // Count already locked morning/afternoon from patterns
  let morningCount = locked.filter((l) => l.shiftType === ShiftType.MORNING && !vacation.find(v => v.userId === l.userId)).length;
  let afternoonCount = locked.filter((l) => l.shiftType === ShiftType.AFTERNOON && !vacation.find(v => v.userId === l.userId)).length;

  // First pass: Honor officer choices if quota allows
  for (const id of remaining) {
    if (morningCount < rule.morningLimit && morningTargets.has(id)) {
      morningCount++;
      assignments.set(id, ShiftType.MORNING);
    }
  }
  for (const id of remaining) {
    if (assignments.has(id)) continue;
    if (afternoonCount < rule.afternoonLimit && afternoonTargets.has(id)) {
      afternoonCount++;
      assignments.set(id, ShiftType.AFTERNOON);
    }
  }

  // Second pass: Randomly assign remaining officers to fill morning first, then afternoon
  const unassigned = remaining.filter((id) => !assignments.has(id));
  const shuffled = shuffle(unassigned);

  for (const id of shuffled) {
    if (morningCount < rule.morningLimit) {
      morningCount++;
      assignments.set(id, ShiftType.MORNING);
    } else if (afternoonCount < rule.afternoonLimit) {
      afternoonCount++;
      assignments.set(id, ShiftType.AFTERNOON);
    } else {
      // If both are full but we still have officers, add them to afternoon (overflow)
      afternoonCount++;
      assignments.set(id, ShiftType.AFTERNOON);
    }
  }

  // Delete existing shifts and create new ones
  await prisma.shift.deleteMany({ where: { date } });

  const createRows = [...assignments.entries()].map(([userId, type]) => ({
    userId,
    date,
    type,
    isLocked: lockedUsers.has(userId),
  }));
  
  const created = await prisma.shift.createMany({
    data: createRows,
  });

  return {
    date: dateISO,
    morningLimit: rule.morningLimit,
    afternoonLimit: rule.afternoonLimit,
    created: created.count,
    available: availableCount,
  };
}
