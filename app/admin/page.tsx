"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import html2canvas from "html2canvas";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type User = {
  id: string;
  fullName: string;
  phone: string;
  role: "ADMIN" | "OFFICER";
  isActive: boolean;
  mustChangePassword: boolean;
};

type Pattern = {
  id?: string;
  userId: string;
  dayOfWeek: number;
  shiftType?: string;
  isActive?: boolean;
};

type Shift = {
  id: string;
  date: string;
  type: string;
  user?: { fullName: string };
};

type Vacation = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  status: string;
  user?: { fullName: string };
};

// Get Mogadishu time parts
function getMogadishuTimeParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Mogadishu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
  };
}

// Get schedule date based on time (12:01 AM - 2:00 PM = today, 2:00 PM - 12:00 AM = tomorrow)
function getScheduleDateForView() {
  const { year, month, day, hour } = getMogadishuTimeParts();
  const today = `${year}-${month}-${day}`;
  if (hour >= 14) {
    // After 2 PM, show tomorrow
    const tomorrow = new Date(`${today}T00:00:00+03:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }
  return today;
}

function getTomorrowISO() {
  const { year, month, day } = getMogadishuTimeParts();
  const today = new Date(`${year}-${month}-${day}T00:00:00+03:00`);
  today.setDate(today.getDate() + 1);
  return today.toISOString().slice(0, 10);
}

function getMogadishuCountdown(autoTime24: string) {
  const { year, month, day, hour, minute } = getMogadishuTimeParts();
  const now = new Date(`${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+03:00`);
  const [h, m] = autoTime24.split(":").map((v) => parseInt(v, 10));
  let target = new Date(`${year}-${month}-${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+03:00`);
  if (now.getTime() >= target.getTime()) {
    target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
  }
  const diff = Math.max(0, target.getTime() - now.getTime());
  const hh = Math.floor(diff / 3600000);
  const mm = Math.floor((diff % 3600000) / 60000);
  const ss = Math.floor((diff % 60000) / 1000);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function getMogadishuTimeString() {
  const { hour, minute } = getMogadishuTimeParts();
  const h12 = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function getScheduleViewLabel() {
  const { hour } = getMogadishuTimeParts();
  return hour >= 14 ? "Tomorrow's Schedule" : "Today's Schedule";
}

function toggleValue<T>(value: T, list: T[], setList: (next: T[]) => void) {
  setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
}

function toggleAll<T>(values: T[], list: T[], setList: (next: T[]) => void) {
  setList(list.length === values.length ? [] : values);
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [dayOff, setDayOff] = useState<Pattern[]>([]);
  const [fullTime, setFullTime] = useState<Pattern[]>([]);
  const [locked, setLocked] = useState<Pattern[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [scheduleDate, setScheduleDate] = useState(() => getScheduleDateForView());
  const [ruleDate, setRuleDate] = useState(() => getScheduleDateForView());
  const [morningLimit, setMorningLimit] = useState<number | "">("");
  // Afternoon auto-calculates from available - morning
  const [availableCount, setAvailableCount] = useState(0);
  const [availableOfficers, setAvailableOfficers] = useState<{ id: string; fullName: string }[]>([]);
  const [autoTime, setAutoTime] = useState("19:00");
  const [countdown, setCountdown] = useState("--:--:--");
  const [currentTime, setCurrentTime] = useState("--:-- --");
  const [whatsText, setWhatsText] = useState("");
  const [message, setMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [expandedDays, setExpandedDays] = useState<number[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [lastScheduleInfo, setLastScheduleInfo] = useState<{ date: string; isAuto: boolean; createdAt?: string } | null>(null);
  const [currentScheduleInfo, setCurrentScheduleInfo] = useState<{ isAuto: boolean; createdAt?: string } | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Pattern form state
  const [patternType, setPatternType] = useState<"dayoff" | "fulltime" | "locked" | "vacation">("dayoff");
  const [patternUsers, setPatternUsers] = useState<string[]>([]);
  const [patternDays, setPatternDays] = useState<number[]>([]);
  const [patternShiftType, setPatternShiftType] = useState("MORNING");
  const [vacationStart, setVacationStart] = useState("");
  const [vacationEnd, setVacationEnd] = useState("");

  const officerUsers = useMemo(() => users.filter((u) => u.role === "OFFICER"), [users]);
  const allOfficerIds = useMemo(() => officerUsers.map((u) => u.id), [officerUsers]);

  // Pattern entry with deletion info
  type PatternEntry = { name: string; userId: string; shiftType?: string; vacationId?: string };
  
  // Organize patterns by day for collapsible table
  const patternsByDay = useMemo(() => {
    const result: Record<number, { dayOff: PatternEntry[]; fullTime: PatternEntry[]; locked: PatternEntry[]; vacation: PatternEntry[] }> = {};
    for (let i = 0; i < 7; i++) {
      result[i] = { dayOff: [], fullTime: [], locked: [], vacation: [] };
    }
    dayOff.forEach((p) => {
      const officer = users.find((u) => u.id === p.userId);
      if (officer) result[p.dayOfWeek].dayOff.push({ name: officer.fullName, userId: p.userId });
    });
    fullTime.forEach((p) => {
      const officer = users.find((u) => u.id === p.userId);
      if (officer) result[p.dayOfWeek].fullTime.push({ name: officer.fullName, userId: p.userId });
    });
    locked.forEach((p) => {
      const officer = users.find((u) => u.id === p.userId);
      if (officer) result[p.dayOfWeek].locked.push({ name: `${officer.fullName} (${p.shiftType})`, userId: p.userId, shiftType: p.shiftType });
    });
    // Add vacations based on day of week
    vacations.filter((v) => v.status === "APPROVED").forEach((v) => {
      const officer = users.find((u) => u.id === v.userId);
      if (officer) {
        const start = new Date(v.startDate);
        const end = new Date(v.endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dow = d.getDay();
          if (!result[dow].vacation.find((e) => e.userId === v.userId)) {
            result[dow].vacation.push({ name: officer.fullName, userId: v.userId, vacationId: v.id });
          }
        }
      }
    });
    return result;
  }, [dayOff, fullTime, locked, vacations, users]);

  const totalPatterns = useMemo(
    () => dayOff.length + fullTime.length + locked.length + vacations.filter((v) => v.status === "APPROVED").length,
    [dayOff, fullTime, locked, vacations]
  );

  // Dashboard Stats
  const dashboardStats = useMemo(() => {
    const adminUsers = users.filter((u) => u.role === "ADMIN");
    const activeOfficers = officerUsers.filter((u) => u.isActive);
    const inactiveOfficers = officerUsers.filter((u) => !u.isActive);
    const activeVacations = vacations.filter((v) => v.status === "APPROVED");
    
    // Shift counts
    const morningShifts = shifts.filter((s) => s.type === "MORNING").length;
    const afternoonShifts = shifts.filter((s) => s.type === "AFTERNOON").length;
    const fulltimeShifts = shifts.filter((s) => s.type === "FULLTIME").length;
    const dayoffShifts = shifts.filter((s) => s.type === "DAYOFF").length;
    const vacationShifts = shifts.filter((s) => s.type === "VACATION").length;
    
    return {
      totalUsers: users.length,
      admins: adminUsers.length,
      totalOfficers: officerUsers.length,
      activeOfficers: activeOfficers.length,
      inactiveOfficers: inactiveOfficers.length,
      totalPatterns,
      dayOffPatterns: dayOff.length,
      fullTimePatterns: fullTime.length,
      lockedPatterns: locked.length,
      activeVacations: activeVacations.length,
      totalShifts: shifts.length,
      morningShifts,
      afternoonShifts,
      fulltimeShifts,
      dayoffShifts,
      vacationShifts,
      workingToday: morningShifts + afternoonShifts + fulltimeShifts,
      offToday: dayoffShifts + vacationShifts,
    };
  }, [users, officerUsers, shifts, dayOff, fullTime, locked, vacations, totalPatterns]);

  useEffect(() => {
    const raw = localStorage.getItem("currentUser");
    if (!raw) {
      router.push("/");
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed.mustChangePassword) {
      router.push("/change-password");
      return;
    }
    
    // Allow ADMIN role OR users with scheduling privileges
    if (parsed.role === "ADMIN" || parsed.role === "SUPER_ADMIN") {
      setUser(parsed);
    } else {
      // Check if user has scheduling privileges
      fetch(`/api/auth/my-privileges?userId=${parsed.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.privilege) {
            const userPriv = data.privilege;
            if (userPriv.canManageSchedules || userPriv.canManagePatterns || userPriv.canManageSettings) {
              setUser(parsed);
            } else {
              router.push("/");
            }
          } else {
            router.push("/");
          }
        })
        .catch(() => {
          router.push("/");
        });
      return;
    }
    
    // Check biometric support
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then((available) => {
        setBiometricSupported(available);
        // Check if biometric is already enabled for this user
        const bioEnabled = localStorage.getItem(`biometric_${parsed.id}`);
        setBiometricEnabled(!!bioEnabled);
      });
    }
  }, [router]);

  // Biometric functions
  const enableBiometric = async () => {
    if (!user || !biometricSupported) return;
    
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Immigration Scheduler", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(user.id),
            name: user.phone,
            displayName: user.fullName,
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      });
      
      if (credential) {
        localStorage.setItem(`biometric_${user.id}`, "enabled");
        localStorage.setItem(`biometric_cred_${user.id}`, credential.id);
        setBiometricEnabled(true);
        setMessage("✅ Biometric login enabled!");
      }
    } catch (err) {
      setMessage("❌ Failed to enable biometric: " + (err as Error).message);
    }
  };

  const disableBiometric = () => {
    if (!user) return;
    localStorage.removeItem(`biometric_${user.id}`);
    localStorage.removeItem(`biometric_cred_${user.id}`);
    setBiometricEnabled(false);
    setMessage("🔓 Biometric login disabled.");
  };

  const loadAll = async (adminId?: string) => {
    const userId = adminId || user?.id;
    const [userRes, dayRes, fullRes, lockRes, settingRes, vacationRes] = await Promise.all([
      fetch(`/api/users/list${userId ? `?requesterId=${userId}` : ""}`).then((r) => r.json()),
      fetch("/api/patterns/dayoff").then((r) => r.json()),
      fetch("/api/patterns/fulltime").then((r) => r.json()),
      fetch("/api/patterns/locked").then((r) => r.json()),
      fetch("/api/settings/auto").then((r) => r.json()),
      fetch("/api/vacations/list").then((r) => r.json()),
    ]);
    if (userRes.ok) setUsers(userRes.users);
    if (dayRes.ok) setDayOff(dayRes.patterns);
    if (fullRes.ok) setFullTime(fullRes.patterns);
    if (lockRes.ok) setLocked(lockRes.patterns);
    if (settingRes.ok && settingRes.setting) setAutoTime(settingRes.setting.autoTime24);
    if (vacationRes.ok) setVacations(vacationRes.vacations);
  };

  useEffect(() => {
    if (user?.id) {
      loadAll(user.id);
      // Initial fetch will check for last schedule if current date has no schedule
      fetchSchedule();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const tick = () => {
      setCountdown(getMogadishuCountdown(autoTime));
      setCurrentTime(getMogadishuTimeString());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [autoTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetch("/api/schedule/auto-run", { method: "POST" });
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Load available officers count
    fetch(`/api/shifts/available-count?date=${ruleDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setAvailableCount(data.count);
          setAvailableOfficers(data.officers || []);
        }
      });
    
    // Load existing rule (if admin already set it)
    fetch(`/api/rules/get?date=${ruleDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.rule) {
          setMorningLimit(data.rule.morningLimit);
        } else {
          // No rule set - leave empty for admin to set
          setMorningLimit("");
        }
      });
    
    // Auto-fetch schedule for the selected date
    fetch(`/api/shifts?date=${ruleDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setShifts(data.shifts);
          setScheduleDate(ruleDate);
        }
      });
    
    // Fetch schedule log info for the selected date
    fetch(`/api/shifts/schedule-log?date=${ruleDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.log) {
          setCurrentScheduleInfo({ isAuto: data.log.isAuto, createdAt: data.log.createdAt });
        } else {
          setCurrentScheduleInfo(null);
        }
      });
  }, [ruleDate]);

  // Helper: Check if selected date is in the past (before today in Mogadishu time)
  const isDatePast = (dateStr: string) => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Mogadishu" });
    return dateStr < today;
  };

  // Helper: Check if selected date is today
  const isDateToday = (dateStr: string) => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Mogadishu" });
    return dateStr === today;
  };

  // Determine schedule state for UI
  const hasExistingSchedule = shifts.length > 0;
  const selectedDateIsPast = isDatePast(ruleDate);

  const logout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  const fetchSchedule = async (dateToFetch?: string) => {
    const date = dateToFetch || scheduleDate;
    const res = await fetch(`/api/shifts?date=${date}`);
    const data = await res.json();
    if (data.ok) {
      setShifts(data.shifts);
      // If no shifts found and we're checking the default date, try to find last schedule
      if (data.shifts.length === 0 && !dateToFetch) {
        const lastRes = await fetch("/api/shifts/last-schedule");
        const lastData = await lastRes.json();
        if (lastData.ok && lastData.date) {
          setScheduleDate(lastData.date);
          setLastScheduleInfo({ date: lastData.date, isAuto: lastData.isAuto ?? false, createdAt: lastData.createdAt });
          // Fetch shifts for the last schedule date
          const lastShiftsRes = await fetch(`/api/shifts?date=${lastData.date}`);
          const lastShiftsData = await lastShiftsRes.json();
          if (lastShiftsData.ok) setShifts(lastShiftsData.shifts);
        }
      } else {
        // Fetch last schedule info for display
        const lastRes = await fetch("/api/shifts/last-schedule");
        const lastData = await lastRes.json();
        if (lastData.ok && lastData.date) {
          setLastScheduleInfo({ date: lastData.date, isAuto: lastData.isAuto ?? false, createdAt: lastData.createdAt });
        }
      }
    }
  };
  
  const deletePattern = async (type: "dayoff" | "fulltime" | "locked" | "vacation", dayOfWeek: number, userId: string, shiftType?: string, vacationId?: string) => {
    let endpoint = "";
    let body: any = { userId, dayOfWeek };
    
    if (type === "dayoff") {
      endpoint = "/api/patterns/dayoff";
    } else if (type === "fulltime") {
      endpoint = "/api/patterns/fulltime";
    } else if (type === "locked") {
      endpoint = "/api/patterns/locked";
      body.shiftType = shiftType;
    } else if (type === "vacation" && vacationId) {
      endpoint = "/api/vacations/delete";
      body = { id: vacationId };
    }
    
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ok) {
      setMessage("✅ Pattern deleted.");
      loadAll();
    } else {
      setMessage("❌ " + (data.error || "Failed"));
    }
  };

  const generateSchedule = async (withRule = false) => {
    // If morning limit is set, save the rule first
    if (withRule && morningLimit !== "") {
      const ruleRes = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: ruleDate, morningLimit: Number(morningLimit), afternoonLimit: calculatedAfternoon }),
      });
      const ruleData = await ruleRes.json();
      if (!ruleData.ok) {
        setMessage("❌ Failed to save rule: " + (ruleData.error || "Unknown error"));
        return;
      }
    }
    
    // Then generate the schedule for the same date (with isAuto: true to fill all slots)
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: ruleDate, isAuto: true }),
    });
    const data = await res.json();
    if (data.ok) {
      setMessage("✅ " + (withRule && morningLimit !== "" ? "Rule saved & " : "") + "Schedule generated!");
      setScheduleDate(ruleDate); // Sync schedule date
      // Fetch the newly generated schedule
      const scheduleRes = await fetch(`/api/shifts?date=${ruleDate}`);
      const scheduleData = await scheduleRes.json();
      if (scheduleData.ok) {
        setShifts(scheduleData.shifts);
      }
      // Fetch schedule log info
      const logRes = await fetch(`/api/shifts/schedule-log?date=${ruleDate}`);
      const logData = await logRes.json();
      if (logData.ok && logData.log) {
        setCurrentScheduleInfo({ isAuto: logData.log.isAuto, createdAt: logData.log.createdAt });
      }
    } else {
      setMessage("❌ " + (data.error || "Failed"));
    }
  };

  const deleteSchedule = async () => {
    const res = await fetch("/api/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: ruleDate }),
    });
    const data = await res.json();
    if (data.ok) {
      setMessage("🗑️ Schedule deleted.");
      setShifts([]);
      setScheduleDate(ruleDate); // Sync
    }
  };

  // Calculate afternoon automatically: available - morning
  const calculatedAfternoon = morningLimit === "" ? 0 : Math.max(availableCount - Number(morningLimit), 0);

  const saveRule = async () => {
    if (morningLimit === "") {
      setMessage("❌ Please set morning limit first");
      return;
    }
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: ruleDate, morningLimit: Number(morningLimit), afternoonLimit: calculatedAfternoon }),
    });
    const data = await res.json();
    setMessage(data.ok ? "✅ Rule saved!" : "❌ " + (data.error || "Failed"));
  };

  const saveAutoTime = async () => {
    const res = await fetch("/api/settings/auto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoTime24: autoTime }),
    });
    const data = await res.json();
    setMessage(data.ok ? "✅ Auto time saved!" : "❌ " + (data.error || "Failed"));
  };

  const createUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = { ...Object.fromEntries(form.entries()), requesterId: user?.id };
    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      setMessage("✅ User created!");
      e.currentTarget.reset();
      loadAll();
    } else {
      setMessage("❌ " + (data.error || "Failed"));
    }
  };

  const updateUser = async (payload: any, silent = false) => {
    const res = await fetch("/api/users/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, requesterId: user?.id }),
    });
    const data = await res.json();
    if (!silent) setMessage(data.ok ? "✅ Updated!" : "❌ " + (data.error || "Failed"));
    if (data.ok) loadAll();
    return data.ok;
  };

  const updateUsersBulk = async (payloads: any[], successMessage: string) => {
    if (payloads.length === 0) {
      setMessage("⚠️ Select at least one user.");
      return;
    }
    const results = await Promise.all(
      payloads.map((payload) =>
        fetch("/api/users/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, requesterId: user?.id }),
        }).then((r) => r.json())
      )
    );
    const success = results.filter((r) => r.ok).length;
    setMessage(`✅ ${successMessage} (${success}/${payloads.length})`);
    loadAll();
  };

  const removeUser = async (id: string) => {
    const res = await fetch("/api/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, requesterId: user?.id }),
    });
    const data = await res.json();
    setMessage(data.ok ? "🗑️ User deleted." : "❌ " + (data.error || "Failed"));
    if (data.ok) loadAll();
  };

  const savePatterns = async () => {
    if (patternType === "vacation") {
      // Save vacations
      if (patternUsers.length === 0 || !vacationStart || !vacationEnd) {
        setMessage("⚠️ Select officers and date range.");
        return;
      }
      const tasks = patternUsers.map((userId) =>
        fetch("/api/vacations/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, startDate: vacationStart, endDate: vacationEnd, status: "APPROVED" }),
        }).then((r) => r.json())
      );
      const results = await Promise.all(tasks);
      const success = results.filter((r) => r.ok).length;
      setMessage(`✅ Saved ${success}/${tasks.length} vacations.`);
      setPatternUsers([]);
      setVacationStart("");
      setVacationEnd("");
      loadAll();
      return;
    }

    if (patternUsers.length === 0 || patternDays.length === 0) {
      setMessage("⚠️ Select at least one officer and one day.");
      return;
    }
    const tasks = patternUsers.flatMap((userId) =>
      patternDays.map((dayOfWeek) =>
        fetch(`/api/patterns/${patternType}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            dayOfWeek,
            ...(patternType === "locked" ? { shiftType: patternShiftType } : {}),
          }),
        }).then((r) => r.json())
      )
    );
    const results = await Promise.all(tasks);
    const success = results.filter((r) => r.ok).length;
    setMessage(`✅ Saved ${success}/${tasks.length} rules.`);
    setPatternUsers([]);
    setPatternDays([]);
    loadAll();
  };

  const copyWhatsApp = async (mode: "full" | "dayoff") => {
    const res = await fetch(`/api/schedule/text?date=${scheduleDate}&mode=${mode}`);
    const data = await res.json();
    if (data.ok) {
      setWhatsText(data.text);
      // Try Web Share API first (mobile)
      if (navigator.share) {
        try {
          await navigator.share({ text: data.text });
          setMessage("✅ Shared successfully!");
        } catch (e: any) {
          if (e.name !== "AbortError") {
            // Fallback to WhatsApp URL
            window.open(`https://wa.me/?text=${encodeURIComponent(data.text)}`, "_blank");
          }
        }
      } else {
        // Desktop: open WhatsApp Web directly
        window.open(`https://wa.me/?text=${encodeURIComponent(data.text)}`, "_blank");
      }
    }
  };

  const resetAllPasswords = async () => {
    const res = await fetch("/api/users/reset-defaults", { method: "POST" });
    const data = await res.json();
    setMessage(data.ok ? `🔑 Reset ${data.count} passwords.` : "❌ " + (data.error || "Failed"));
    if (data.ok) loadAll();
  };

  const toggleDayExpanded = (day: number) => {
    setExpandedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Navigation sections for swipe
  const navSections = ["home", "schedule", "users", "profile"];
  
  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadAll(), fetchSchedule()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Navigate to section with animation
  const navigateToSection = (section: string | null, direction: "left" | "right" = "left") => {
    setSlideDirection(direction);
    setTimeout(() => {
      setActiveSection(section);
      setShowProfile(section === "profile");
      setTimeout(() => setSlideDirection(null), 50);
    }, 150);
  };

  // Swipe gesture handlers - increased to 100px to reduce accidental triggers
  const minSwipeDistance = 100;
  
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isRightSwipe && activeSection) {
      // Swipe right = go back to home
      navigateToSection(null, "right");
    }
  };

  return (
    <div className="admin-page" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Mobile Header */}
      <header className="mobile-header">
        <button className={`refresh-btn ${isRefreshing ? "spinning" : ""}`} onClick={handleRefresh} aria-label="Refresh">
          🔄
        </button>
        <div className="mobile-brand">
          <span>🛫</span>
          <span>{activeSection ? activeSection.charAt(0).toUpperCase() + activeSection.slice(1) : "Dashboard"}</span>
        </div>
        <div className="mobile-time">{currentTime}</div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && <div className="menu-overlay" onClick={closeMobileMenu}></div>}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-header-mobile">
        <div className="sidebar-brand">
            <span className="brand-icon">🛫</span>
            <span className="brand-text">Immigration</span>
          </div>
          <button className="close-menu-btn" onClick={closeMobileMenu} aria-label="Close menu">✕</button>
        </div>
        <div className="sidebar-brand desktop-only">
          <span className="brand-icon">🇸🇴</span>
          <span className="brand-text">Immigration</span>
        </div>
        <nav className="sidebar-nav">
          <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); closeMobileMenu(); setShowProfile(true); }}>
            <span className="nav-icon">👤</span> <span className="nav-text">Profile</span>
          </a>
          <a href="#" className={`nav-item ${!activeSection ? "active" : ""}`} onClick={(e) => { e.preventDefault(); closeMobileMenu(); setActiveSection(null); }}>
            <span className="nav-icon">🏠</span> <span className="nav-text">Dashboard</span>
          </a>
          <a href="#schedule" className={`nav-item ${activeSection === "schedule" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); closeMobileMenu(); setActiveSection("schedule"); }}>
            <span className="nav-icon">📆</span> <span className="nav-text">Schedule</span>
          </a>
          <a href="#patterns" className={`nav-item ${activeSection === "patterns" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); closeMobileMenu(); setActiveSection("patterns"); }}>
            <span className="nav-icon">📅</span> <span className="nav-text">Patterns</span>
          </a>
          <a href="#users" className={`nav-item ${activeSection === "users" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); closeMobileMenu(); setActiveSection("users"); }}>
            <span className="nav-icon">👥</span> <span className="nav-text">Users</span>
          </a>
          <a href="#settings" className={`nav-item ${activeSection === "settings" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); closeMobileMenu(); setActiveSection("settings"); }}>
            <span className="nav-icon">⚙️</span> <span className="nav-text">Settings</span>
          </a>
        </nav>
        <div className="sidebar-footer">
          <div className="time-display">
            <span className="time-label">Mogadishu Time</span>
            <span className="time-value">{currentTime}</span>
          </div>
          <button className="btn btn-logout" onClick={logout}>
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`main-content ${slideDirection ? `slide-${slideDirection}` : ""}`}>
        {/* Header - Desktop Only */}
        <header className="top-header desktop-only">
          <div className="header-left">
            <h1>Dashboard</h1>
            <p className="muted">Welcome back, {user?.fullName}</p>
          </div>
          <div className="header-right">
            <div className="countdown-card">
              <div className="countdown-icon">⏰</div>
              <div className="countdown-info">
                <span className="countdown-label">Auto-Schedule In</span>
                <span className="countdown-value">{countdown}</span>
              </div>
            </div>
          </div>
        </header>

        {message && (
          <div className="toast-message" onClick={() => setMessage("")}>
            {message}
          </div>
        )}

        {/* Profile Section - Full Screen on Mobile */}
        {activeSection === "profile" && (
          <section className="mobile-full-section profile-screen">
            <div className="section-header-mobile">
              <button className="back-btn" onClick={() => navigateToSection(null, "right")}>← Back</button>
              <h2>My Profile</h2>
            </div>
            <div className="profile-content">
              <div className="profile-card-large">
                <div className="profile-avatar-large">
                  {user?.fullName?.charAt(0)?.toUpperCase() || "?"}
          </div>
                <h3>{user?.fullName}</h3>
                <span className={`role-badge ${user?.role?.toLowerCase()}`}>{user?.role}</span>
            </div>
              <div className="profile-info-list">
                <div className="info-item">
                  <span className="info-icon">📱</span>
                  <div className="info-text">
                    <span className="info-label">Phone</span>
                    <span className="info-value">{user?.phone}</span>
          </div>
            </div>
                <div className="info-item">
                  <span className="info-icon">✅</span>
                  <div className="info-text">
                    <span className="info-label">Status</span>
                    <span className="info-value status-active">Active</span>
          </div>
                </div>
                <div className="info-item">
                  <span className="info-icon">🌍</span>
                  <div className="info-text">
                    <span className="info-label">Timezone</span>
                    <span className="info-value">Africa/Mogadishu</span>
            </div>
          </div>
              </div>
              
              {/* Menu Items */}
              <div className="profile-menu">
                <div className="menu-label">Menu</div>
                <button className="menu-item" onClick={() => navigateToSection("patterns", "left")}>
                  <span className="menu-icon">📋</span>
                  <span className="menu-text">Patterns</span>
                  <span className="menu-arrow">→</span>
                </button>
                <button className="menu-item" onClick={() => navigateToSection("settings", "left")}>
                  <span className="menu-icon">⚙️</span>
                  <span className="menu-text">Settings</span>
                  <span className="menu-arrow">→</span>
                </button>
              </div>
              
              {biometricSupported && (
                <div className="settings-card">
                  <div className="settings-item">
                    <span className="settings-icon">🔐</span>
                    <div className="settings-text">
                      <span className="settings-title">Biometric Login</span>
                      <span className="settings-desc">{biometricEnabled ? "Enabled" : "Disabled"}</span>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" checked={biometricEnabled} onChange={() => biometricEnabled ? disableBiometric() : enableBiometric()} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              )}
              
              <button className="btn-logout-full" onClick={logout}>
                🚪 Logout
              </button>
            </div>
          </section>
        )}

        {/* Desktop Profile Modal */}
        {showProfile && activeSection !== "profile" && (
          <div className="modal-overlay desktop-only" onClick={() => setShowProfile(false)}>
            <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>👤 My Profile</h2>
                <button className="close-btn" onClick={() => setShowProfile(false)}>✕</button>
              </div>
              <div className="profile-card">
                <div className="profile-avatar">
                  {user?.fullName?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="profile-info">
                  <h3>{user?.fullName}</h3>
                  <span className={`role-badge ${user?.role?.toLowerCase()}`}>{user?.role}</span>
                </div>
              </div>
              <div className="profile-details">
                <div className="detail-row">
                  <span className="detail-label">📱 Phone</span>
                  <span className="detail-value">{user?.phone}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">🔐 Status</span>
                  <span className="detail-value status-active">Active</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">🕐 Timezone</span>
                  <span className="detail-value">Africa/Mogadishu</span>
                </div>
              </div>
              
              {biometricSupported && (
                <div className="biometric-section">
                  <div className="biometric-header">
                    <span className="biometric-icon">🔐</span>
                    <div className="biometric-info">
                      <span className="biometric-title">Biometric Login</span>
                      <span className="biometric-desc">Use Face ID or Fingerprint</span>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" checked={biometricEnabled} onChange={() => biometricEnabled ? disableBiometric() : enableBiometric()} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <p className="biometric-note">
                    {biometricEnabled ? "✅ Quick login with biometrics is enabled" : "Enable to quickly unlock the app with your face or fingerprint"}
                  </p>
                </div>
              )}
              
              {!biometricSupported && (
                <div className="biometric-unsupported">
                  <span>📵</span>
                  <span>Biometric login not available on this device</span>
                </div>
              )}
              
              <div className="profile-actions">
                <button className="btn btn-primary btn-block" onClick={() => { setShowProfile(false); navigateToSection("settings", "left"); }}>
                  🔑 Change Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Home View */}
        {!activeSection && (
          <>
        {/* Brand New Dashboard Design */}
        <div className="dash-container">
          {/* Users Card - Indigo Theme */}
          <div className="dash-box indigo" onClick={() => navigateToSection("users", "left")}>
            <div className="box-pattern"></div>
            <div className="box-header">
              <div className="box-icon-wrapper">
                <div className="box-icon">👥</div>
              </div>
              <div className="box-badge">{dashboardStats.totalUsers}</div>
            </div>
            <h3 className="box-title">Team Officers</h3>
            <p className="box-desc">Manage your team</p>
            <div className="box-stats">
              <div className="stat-item active">
                <div className="stat-indicator"></div>
                <span className="stat-label">Active</span>
                <span className="stat-value">{dashboardStats.activeOfficers}</span>
              </div>
              <div className="stat-item inactive">
                <div className="stat-indicator"></div>
                <span className="stat-label">Inactive</span>
                <span className="stat-value">{dashboardStats.inactiveOfficers}</span>
              </div>
            </div>
          </div>

          {/* Schedule Card - Teal Theme */}
          <div className="dash-box teal" onClick={() => navigateToSection("schedule", "left")}>
            <div className="box-pattern"></div>
            <div className="box-header">
              <div className="box-icon-wrapper">
                <div className="box-icon">📅</div>
              </div>
              <div className="box-badge">{dashboardStats.workingToday}</div>
            </div>
            <h3 className="box-title">Today's Shifts</h3>
            <p className="box-desc">Active assignments</p>
            <div className="box-grid">
              <div className="grid-cell">
                <span className="cell-icon">🌅</span>
                <span className="cell-num">{dashboardStats.morningShifts}</span>
                <span className="cell-label">AM</span>
              </div>
              <div className="grid-cell">
                <span className="cell-icon">🌇</span>
                <span className="cell-num">{dashboardStats.afternoonShifts}</span>
                <span className="cell-label">PM</span>
              </div>
              <div className="grid-cell">
                <span className="cell-icon">⏰</span>
                <span className="cell-num">{dashboardStats.fulltimeShifts}</span>
                <span className="cell-label">Full</span>
              </div>
            </div>
          </div>

          {/* Patterns Card - Rose Theme */}
          <div className="dash-box rose" onClick={() => navigateToSection("patterns", "left")}>
            <div className="box-pattern"></div>
            <div className="box-header">
              <div className="box-icon-wrapper">
                <div className="box-icon">📋</div>
              </div>
              <div className="box-badge">{dashboardStats.totalPatterns}</div>
            </div>
            <h3 className="box-title">Weekly Rules</h3>
            <p className="box-desc">Recurring patterns</p>
            <div className="box-progress">
              <div className="progress-item">
                <div className="progress-label">
                  <span>🏠 Day-Off</span>
                  <span>{dashboardStats.dayOffPatterns}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${(dashboardStats.dayOffPatterns / Math.max(1, dashboardStats.totalPatterns)) * 100}%`}}></div>
                </div>
              </div>
              <div className="progress-item">
                <div className="progress-label">
                  <span>⏰ Full-Time</span>
                  <span>{dashboardStats.fullTimePatterns}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${(dashboardStats.fullTimePatterns / Math.max(1, dashboardStats.totalPatterns)) * 100}%`}}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Available Card - Amber Theme */}
          <div className="dash-box amber" onClick={() => navigateToSection("schedule", "left")}>
            <div className="box-pattern"></div>
            <div className="box-header">
              <div className="box-icon-wrapper">
                <div className="box-icon">✅</div>
              </div>
              <div className="box-badge">{availableCount}</div>
            </div>
            <h3 className="box-title">Available Now</h3>
            <p className="box-desc">Ready for assignment</p>
            <div className="box-distribution">
              <div className="dist-col">
                <div className="dist-value">{Math.ceil((availableCount * 3) / 5)}</div>
                <div className="dist-label">
                  <span className="dist-icon">🌅</span>
                  <span>Morning</span>
                </div>
                <div className="dist-percent">60%</div>
              </div>
              <div className="dist-divider">
                <div className="divider-line"></div>
              </div>
              <div className="dist-col">
                <div className="dist-value">{Math.floor((availableCount * 2) / 5)}</div>
                <div className="dist-label">
                  <span className="dist-icon">🌇</span>
                  <span>Afternoon</span>
                </div>
                <div className="dist-percent">40%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Info Panel */}
        <div className="info-panel">
          <div className="panel-item">
            <div className="panel-icon time-icon">🕐</div>
            <div className="panel-content">
              <span className="panel-label">Current Time</span>
              <strong className="panel-value">{currentTime}</strong>
            </div>
          </div>
          <div className="panel-item highlight">
            <div className="panel-icon auto-icon">⏳</div>
            <div className="panel-content">
              <span className="panel-label">Auto Schedule</span>
              <strong className="panel-value">{countdown}</strong>
            </div>
          </div>
          <div className="panel-item">
            <div className="panel-icon date-icon">📆</div>
            <div className="panel-content">
              <span className="panel-label">Last Update</span>
              <strong className="panel-value">{lastScheduleInfo?.date?.slice(5) || "—"}</strong>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="action-panel">
          <button className="action-button primary" onClick={async () => {
            const card = document.getElementById("schedule-card");
            if (!card) return;
            try {
              const canvas = await html2canvas(card, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
              const link = document.createElement("a");
              link.download = `schedule-${scheduleDate}.png`;
              link.href = canvas.toDataURL("image/png");
              link.click();
              setMessage("✅ Image Saved!");
            } catch { setMessage("❌ Failed"); }
          }}>
            <span className="action-icon">📥</span>
            <div className="action-text">
              <span className="action-title">Save Image</span>
              <span className="action-subtitle">Download PNG</span>
            </div>
          </button>
          <button className="action-button success" onClick={() => copyWhatsApp("full")}>
            <span className="action-icon">📲</span>
            <div className="action-text">
              <span className="action-title">WhatsApp</span>
              <span className="action-subtitle">Share Full</span>
            </div>
          </button>
          <button className="action-button secondary" onClick={() => copyWhatsApp("dayoff")}>
            <span className="action-icon">🏠</span>
            <div className="action-text">
              <span className="action-title">Day-Off</span>
              <span className="action-subtitle">Weekly</span>
            </div>
          </button>
        </div>

        {/* Clean Light Schedule Card */}
        <div className="schedule-card-container">
          <div className="schedule-card" id="schedule-card">
            {/* Header */}
            <div className="sc-header">
              <div className="sc-brand">
                <div className="sc-logo">🛫</div>
                <div className="sc-title">
                  <strong>Immigration Office</strong>
                  <span>Daily Schedule</span>
                </div>
              </div>
              <div className="sc-date">
                <div className="sc-day">{new Date(scheduleDate).toLocaleDateString("en-US", { weekday: "long", timeZone: "Africa/Mogadishu" })}</div>
                <div className="sc-fulldate">{new Date(scheduleDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Mogadishu" })}</div>
              </div>
            </div>

            {/* Shifts */}
            <div className="sc-body">
              {shifts.filter(s => s.type === "MORNING").length > 0 && (
                <div className="sc-shift morning">
                  <div className="sc-shift-header">
                    <div className="sc-shift-icon">🌅</div>
                    <div className="sc-shift-info">
                      <strong>Morning Shift</strong>
                      <span>8:00 AM - 2:00 PM</span>
                    </div>
                    <div className="sc-shift-count">{shifts.filter(s => s.type === "MORNING").length}</div>
                  </div>
                  <div className="sc-names">{shifts.filter(s => s.type === "MORNING").map(s => s.user?.fullName).join(" • ")}</div>
                </div>
              )}
              
              {shifts.filter(s => s.type === "AFTERNOON").length > 0 && (
                <div className="sc-shift afternoon">
                  <div className="sc-shift-header">
                    <div className="sc-shift-icon">🌇</div>
                    <div className="sc-shift-info">
                      <strong>Afternoon Shift</strong>
                      <span>2:00 PM - 8:00 PM</span>
                    </div>
                    <div className="sc-shift-count">{shifts.filter(s => s.type === "AFTERNOON").length}</div>
                  </div>
                  <div className="sc-names">{shifts.filter(s => s.type === "AFTERNOON").map(s => s.user?.fullName).join(" • ")}</div>
                </div>
              )}

              {shifts.filter(s => s.type === "FULLTIME").length > 0 && (
                <div className="sc-shift fulltime">
                  <div className="sc-shift-header">
                    <div className="sc-shift-icon">⏰</div>
                    <div className="sc-shift-info">
                      <strong>Full Day</strong>
                      <span>8:00 AM - 8:00 PM</span>
                    </div>
                    <div className="sc-shift-count">{shifts.filter(s => s.type === "FULLTIME").length}</div>
                  </div>
                  <div className="sc-names">{shifts.filter(s => s.type === "FULLTIME").map(s => s.user?.fullName).join(" • ")}</div>
                </div>
              )}

              {shifts.filter(s => s.type === "DAYOFF").length > 0 && (
                <div className="sc-shift dayoff">
                  <div className="sc-shift-header">
                    <div className="sc-shift-icon">🏠</div>
                    <div className="sc-shift-info">
                      <strong>Day Off</strong>
                      <span>Rest Day</span>
                    </div>
                    <div className="sc-shift-count">{shifts.filter(s => s.type === "DAYOFF").length}</div>
                  </div>
                  <div className="sc-names">{shifts.filter(s => s.type === "DAYOFF").map(s => s.user?.fullName).join(" • ")}</div>
                </div>
              )}

              {shifts.length === 0 && (
                <div className="sc-empty">
                  <span className="sc-empty-icon">📭</span>
                  <span>No schedule for this date</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sc-footer">
              <div className="sc-summary">
                <div className="sc-sum-item working"><strong>{shifts.filter(s => !["DAYOFF", "VACATION"].includes(s.type)).length}</strong> Working</div>
                <div className="sc-sum-item off"><strong>{shifts.filter(s => ["DAYOFF", "VACATION"].includes(s.type)).length}</strong> Off</div>
                <div className="sc-sum-item total"><strong>{shifts.length}</strong> Total</div>
              </div>
            </div>
          </div>
        </div>
        
          </>
        )}

        {/* Sections - Visible based on activeSection */}
        {(activeSection === "patterns" || activeSection === "schedule" || activeSection === "users" || activeSection === "settings") && (
          <>
            {/* Section Header for Mobile */}
            <div className="section-header-mobile">
              <button className="back-btn" onClick={() => navigateToSection(null, "right")}>← Back</button>
              <h2>{activeSection === "patterns" ? "Patterns" : activeSection === "schedule" ? "Schedule" : activeSection === "users" ? "Users" : "Settings"}</h2>
        </div>

        {/* 1. Rules by Day - Collapsible */}
        <section id="rules" className={`panel panel-wide ${activeSection !== "patterns" ? "hidden-section" : ""}`}>
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="title-icon">📋</span> Rules by Day
            </h2>
            <span className="badge">{totalPatterns} total rules</span>
          </div>
          <div className="collapsible-table">
            {FULL_DAYS.map((dayName, dayIndex) => {
              const data = patternsByDay[dayIndex];
              const hasData = data.dayOff.length + data.fullTime.length + data.locked.length + data.vacation.length > 0;
              const isExpanded = expandedDays.includes(dayIndex);
              return (
                <div key={dayIndex} className={`day-row ${isExpanded ? "expanded" : ""}`}>
                  <div className="day-header" onClick={() => toggleDayExpanded(dayIndex)}>
                    <span className="day-name">{dayName}</span>
                    <div className="day-badges">
                      {data.dayOff.length > 0 && <span className="mini-badge yellow">{data.dayOff.length} 🏠</span>}
                      {data.fullTime.length > 0 && <span className="mini-badge blue">{data.fullTime.length} ⏰</span>}
                      {data.locked.length > 0 && <span className="mini-badge pink">{data.locked.length} 🔒</span>}
                      {data.vacation.length > 0 && <span className="mini-badge green">{data.vacation.length} 🏖️</span>}
                      {!hasData && <span className="mini-badge gray">Empty</span>}
                    </div>
                    <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
                  </div>
                  {isExpanded && hasData && (
                    <div className="day-content">
                      {data.dayOff.length > 0 && (
                        <div className="pattern-group yellow">
                          <span className="group-label">🏠 Day-Off</span>
                          <div className="officer-tags">
                            {data.dayOff.map((entry, idx) => (
                              <span key={idx} className="officer-tag">
                                {entry.name}
                                <button 
                                  className="tag-delete" 
                                  onClick={(e) => { e.stopPropagation(); deletePattern("dayoff", dayIndex, entry.userId); }}
                                >✕</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {data.fullTime.length > 0 && (
                        <div className="pattern-group blue">
                          <span className="group-label">⏰ Full-Time</span>
                          <div className="officer-tags">
                            {data.fullTime.map((entry, idx) => (
                              <span key={idx} className="officer-tag">
                                {entry.name}
                                <button 
                                  className="tag-delete" 
                                  onClick={(e) => { e.stopPropagation(); deletePattern("fulltime", dayIndex, entry.userId); }}
                                >✕</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {data.locked.length > 0 && (
                        <div className="pattern-group pink">
                          <span className="group-label">🔒 Locked</span>
                          <div className="officer-tags">
                            {data.locked.map((entry, idx) => (
                              <span key={idx} className="officer-tag">
                                {entry.name}
                                <button 
                                  className="tag-delete" 
                                  onClick={(e) => { e.stopPropagation(); deletePattern("locked", dayIndex, entry.userId, entry.shiftType); }}
                                >✕</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {data.vacation.length > 0 && (
                        <div className="pattern-group green">
                          <span className="group-label">🏖️ Vacation</span>
                          <div className="officer-tags">
                            {data.vacation.map((entry, idx) => (
                              <span key={idx} className="officer-tag">
                                {entry.name}
                                <button 
                                  className="tag-delete" 
                                  onClick={(e) => { e.stopPropagation(); deletePattern("vacation", dayIndex, entry.userId, undefined, entry.vacationId); }}
                                >✕</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. WhatsApp Export - Hidden since it's in dashboard */}
        <section id="whatsapp" className="panel panel-wide hidden-section">
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="title-icon">📣</span> WhatsApp Export
            </h2>
          </div>
          <div className="whatsapp-actions">
            <button className="btn btn-success btn-lg" onClick={() => copyWhatsApp("full")}>
              📲 Share Full Schedule
            </button>
            <button className="btn btn-lg" onClick={() => copyWhatsApp("dayoff")}>
              🏠 Share Day-Off Only
            </button>
          </div>
          {whatsText && <pre className="whatsapp-box">{whatsText}</pre>}
        </section>

        {/* 3. Daily Schedule - Smart Flow */}
        <section id="schedule" className={`panel panel-wide ${activeSection !== "schedule" ? "hidden-section" : ""}`}>
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="title-icon">📆</span> Schedule
            </h2>
          </div>
          
          {/* Step 1: Date Selection - Always Visible */}
          <div className="schedule-flow">
            <div className="date-selector-card">
              <div className="date-selector-icon">📅</div>
              <div className="date-selector-content">
                <label>Select Date</label>
                <input 
                  type="date" 
                  className="input input-lg" 
                  value={ruleDate} 
                  onChange={(e) => setRuleDate(e.target.value)}
                />
              </div>
              <div className={`date-status ${hasExistingSchedule ? "has-schedule" : selectedDateIsPast ? "past" : "future"}`}>
                {hasExistingSchedule ? "✅ Has Schedule" : selectedDateIsPast ? "⏰ Past Date" : isDateToday(ruleDate) ? "📍 Today" : "📆 Future"}
              </div>
            </div>

            {/* Case 1: Has existing schedule - Show schedule with info, copy and delete */}
            {hasExistingSchedule && (
              <div className="existing-schedule-view">
                <div className="schedule-status-bar success">
                  <span className="status-icon">✅</span>
                  <div className="status-info">
                    <span className="status-text">Schedule for {ruleDate}</span>
                    {currentScheduleInfo && (
                      <span className="status-meta">
                        {currentScheduleInfo.isAuto ? "🤖 Auto-generated" : "👤 Manually created"}
                        {currentScheduleInfo.createdAt && (
                          <> at {new Date(currentScheduleInfo.createdAt).toLocaleString("en-US", { 
                            timeZone: "Africa/Mogadishu", 
                            hour: "numeric", 
                            minute: "2-digit",
                            hour12: true,
                            month: "short",
                            day: "numeric"
                          })}</>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="schedule-actions">
                  <button className="btn btn-whatsapp" onClick={async () => {
                    const res = await fetch(`/api/schedule/text?date=${ruleDate}`);
                    const data = await res.json();
                    if (data.ok) {
                      // Try Web Share API first (works on mobile)
                      if (navigator.share) {
                        try {
                          await navigator.share({ text: data.text });
                          setMessage("✅ Shared successfully!");
                        } catch (e: any) {
                          if (e.name !== "AbortError") {
                            // Fallback to WhatsApp URL
                            window.open(`https://wa.me/?text=${encodeURIComponent(data.text)}`, "_blank");
                          }
                        }
                      } else {
                        // Desktop: open WhatsApp Web directly
                        window.open(`https://wa.me/?text=${encodeURIComponent(data.text)}`, "_blank");
                      }
                    }
                  }}>
                    📲 Share to WhatsApp
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={deleteSchedule}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            )}

            {/* Case 2: Past date with no records */}
            {!hasExistingSchedule && selectedDateIsPast && (
              <div className="no-schedule-past">
                <div className="empty-state-card">
                  <div className="empty-icon">⏰</div>
                  <h3>Past Date</h3>
                  <p>This date ({ruleDate}) is in the past and has no schedule records.</p>
                </div>
              </div>
            )}

            {/* Case 3: Today or future date with no records - Show configuration */}
            {!hasExistingSchedule && !selectedDateIsPast && (
              <div className="create-schedule-view">
                {/* Officer Limits */}
                <div className="config-section">
                  <h3 className="config-title">Set Shift Limits</h3>
                  <div className="unified-limits">
                    <div className="limit-card morning">
                      <div className="limit-icon">🌅</div>
                      <div className="limit-info">
                        <label>Morning Officers</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                          max={availableCount}
                  value={morningLimit}
                          placeholder={`~${Math.ceil((availableCount * 3) / 5)}`}
                          onChange={(e) => setMorningLimit(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
                    </div>
                    <div className="limit-card afternoon">
                      <div className="limit-icon">🌇</div>
                      <div className="limit-info">
                        <label>Afternoon (auto)</label>
                <input
                  type="number"
                          className="input input-readonly"
                          value={morningLimit === "" ? "" : calculatedAfternoon}
                          readOnly
                          placeholder="Auto"
                />
              </div>
                    </div>
                  </div>
            </div>
            
                {/* Available Officers */}
                <div className="config-section">
                  <div className="unified-available">
                    <div className="available-badge">
                      <span className="badge-count">{availableCount}</span>
                      <span className="badge-label">Available</span>
              </div>
                    <div className="available-suggestion">
                      Suggested: {Math.ceil((availableCount * 3) / 5)} morning / {Math.floor((availableCount * 2) / 5)} afternoon
              </div>
              </div>
            </div>

                {/* Generate Button */}
                <div className="generate-section">
                  <button 
                    className="btn btn-success btn-block btn-lg" 
                    onClick={() => generateSchedule(true)}
                    disabled={morningLimit === ""}
                  >
                    ✨ Generate Schedule for {ruleDate}
              </button>
                  {morningLimit === "" && (
                    <p className="hint-text">Set morning limit to enable generation</p>
                  )}
            </div>
          </div>
            )}
          </div>
          {/* Only show schedule grid if there are shifts */}
          {hasExistingSchedule && (
          <div className="schedule-grid">
            {["MORNING", "AFTERNOON", "FULLTIME", "DAYOFF", "VACATION"].map((shiftType) => {
              const shiftList = shifts.filter((s) => s.type === shiftType);
                // Hide empty columns
                if (shiftList.length === 0) return null;
              return (
                <div key={shiftType} className={`schedule-column ${shiftType.toLowerCase()}`}>
                  <div className="column-header">
                    <span className="column-icon">
                      {shiftType === "MORNING" ? "🌅" : shiftType === "AFTERNOON" ? "🌇" : shiftType === "FULLTIME" ? "⏰" : shiftType === "DAYOFF" ? "🏠" : "🏖️"}
                    </span>
                    <span>{shiftType}</span>
                    <span className="column-count">{shiftList.length}</span>
                  </div>
                  <div className="column-list">
                    {shiftList.map((s) => (
                      <div key={s.id} className="shift-item">
                        {s.user?.fullName}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </section>

        {/* 4. Weekly Patterns Form */}
        <section id="patterns" className={`panel panel-wide panel-accent ${activeSection !== "patterns" ? "hidden-section" : ""}`}>
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="title-icon">📅</span> Weekly Patterns
            </h2>
          </div>

          {/* Pattern Type Selector */}
          <div className="pattern-types">
            {[
              { key: "dayoff", icon: "🏠", label: "Day-Off", color: "yellow" },
              { key: "fulltime", icon: "⏰", label: "Full-Time", color: "blue" },
              { key: "locked", icon: "🔒", label: "Locked", color: "pink" },
              { key: "vacation", icon: "🏖️", label: "Vacation", color: "green" },
            ].map((pt) => (
              <button
                key={pt.key}
                className={`pattern-type-btn ${pt.color} ${patternType === pt.key ? "active" : ""}`}
                onClick={() => setPatternType(pt.key as any)}
              >
                <span>{pt.icon}</span>
                <span>{pt.label}</span>
              </button>
            ))}
          </div>

          {/* Locked Shift Type */}
          {patternType === "locked" && (
            <div className="shift-type-row">
              {["MORNING", "AFTERNOON", "FULLTIME"].map((st) => (
                <button
                  key={st}
                  className={`shift-btn ${patternShiftType === st ? "active" : ""}`}
                  onClick={() => setPatternShiftType(st)}
                >
                  {st === "MORNING" ? "🌅" : st === "AFTERNOON" ? "🌇" : "⏰"} {st}
                </button>
              ))}
            </div>
          )}

          {/* Vacation Date Range */}
          {patternType === "vacation" && (
            <div className="date-range-row">
              <div className="date-input">
                <label>Start Date</label>
                <input type="date" className="input" value={vacationStart} onChange={(e) => setVacationStart(e.target.value)} />
              </div>
              <div className="date-input">
                <label>End Date</label>
                <input type="date" className="input" value={vacationEnd} onChange={(e) => setVacationEnd(e.target.value)} />
              </div>
            </div>
          )}

          <div className="pattern-form-grid">
            {/* Officers Selection */}
            <div className="selection-section">
              <div className="selection-header">
                <span>Officers</span>
                <button className="btn btn-xs" onClick={() => toggleAll(allOfficerIds, patternUsers, setPatternUsers)}>
                  {patternUsers.length === allOfficerIds.length ? "Clear" : "All"}
                </button>
              </div>
              <div className="checkbox-grid">
                {officerUsers.map((u) => (
                  <label key={u.id} className={`checkbox-chip ${patternUsers.includes(u.id) ? "checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={patternUsers.includes(u.id)}
                      onChange={() => toggleValue(u.id, patternUsers, setPatternUsers)}
                    />
                    {u.fullName}
                  </label>
                ))}
              </div>
            </div>

            {/* Days Selection (not for vacation) */}
            {patternType !== "vacation" && (
              <div className="selection-section">
                <div className="selection-header">
                  <span>Days</span>
                  <button className="btn btn-xs" onClick={() => toggleAll([0, 1, 2, 3, 4, 5, 6], patternDays, setPatternDays)}>
                    {patternDays.length === 7 ? "Clear" : "All"}
                  </button>
                </div>
                <div className="days-row">
                  {DAYS.map((day, i) => (
                    <button
                      key={day}
                      className={`day-btn ${patternDays.includes(i) ? "active" : ""}`}
                      onClick={() => toggleValue(i, patternDays, setPatternDays)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="btn btn-primary btn-block btn-lg" onClick={savePatterns}>
            💾 Save {patternType === "vacation" ? "Vacations" : "Patterns"}
          </button>
        </section>

        {/* Two Column Layout for User Management */}
        <div className={`content-grid ${activeSection !== "users" ? "hidden-section" : ""}`}>
          {/* Left Column */}
          <div className="content-col">
            {/* 5. Register User */}
            <section id="register" className="panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  <span className="title-icon">➕</span> Register User
                </h2>
              </div>
              <form onSubmit={createUser} className="compact-form">
                <div className="form-grid-2">
                  <input className="input" name="fullName" placeholder="Full name" required />
                  <input className="input" name="phone" placeholder="252xxxxxxxxx" required />
                </div>
                <div className="form-grid-2">
                  <input className="input" name="password" placeholder="Password (optional)" type="password" />
                  <select name="role" className="input">
                    <option value="OFFICER">Officer</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <button className="btn btn-primary btn-block">Create User</button>
              </form>
            </section>
          </div>

          {/* Right Column */}
          <div className="content-col">
            {/* 6. Users Management */}
            <section id="users" className="panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  <span className="title-icon">👥</span> Users
                </h2>
                <div className="panel-actions">
                  <span className="badge">{selectedUsers.length} selected</span>
                  <button className="btn btn-sm" onClick={resetAllPasswords}>
                    🔑 Reset All
                  </button>
                </div>
              </div>
              <div className="bulk-bar">
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => updateUsersBulk(selectedUsers.map((id) => ({ id, isActive: true })), "Activated")}
                >
                  ✅ Activate
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => updateUsersBulk(selectedUsers.map((id) => ({ id, isActive: false })), "Deactivated")}
                >
                  ⛔ Deactivate
                </button>
              </div>
              <div className="users-list">
                {users.map((u) => (
                  <div key={u.id} className={`user-row ${u.isActive ? "" : "inactive"}`}>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() => toggleValue(u.id, selectedUsers, setSelectedUsers)}
                    />
                    <div className="user-info">
                      <span className="user-name">{u.fullName}</span>
                      <span className="user-phone">{u.phone}</span>
                    </div>
                    <span className={`role-badge ${u.role.toLowerCase()}`}>{u.role}</span>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={u.isActive}
                        onChange={(e) => updateUser({ id: u.id, isActive: e.target.checked }, true)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <button
                      className="btn btn-icon"
                      onClick={() => removeUser(u.id)}
                      disabled={u.id === user?.id}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* 7. Settings */}
        <section id="settings" className={`panel panel-wide ${activeSection !== "settings" ? "hidden-section" : ""}`}>
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="title-icon">⚙️</span> Settings
            </h2>
          </div>
          <div className="settings-grid">
            <div className="settings-row">
              <label>Auto-Schedule Time</label>
              <div className="input-group">
                <input type="time" className="input" value={autoTime} onChange={(e) => setAutoTime(e.target.value)} />
                <button className="btn btn-primary" onClick={saveAutoTime}>
                  Save
                </button>
              </div>
            </div>
            <div className="settings-row">
              <label>My Password</label>
              <div className="input-group">
                <input
                  type="password"
                  className="input"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  className="btn"
                  onClick={() => {
                    if (newPassword) {
                      updateUser({ id: user?.id, password: newPassword, mustChangePassword: false });
                      setNewPassword("");
                    }
                  }}
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        </section>
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`nav-btn ${!activeSection ? "active" : ""}`} 
          onClick={() => navigateToSection(null, activeSection ? "right" : "left")}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
          <span className="nav-indicator"></span>
        </button>
        <button 
          className={`nav-btn ${activeSection === "schedule" ? "active" : ""}`}
          onClick={() => navigateToSection("schedule", "left")}
        >
          <span className="nav-icon">📆</span>
          <span className="nav-label">Schedule</span>
          <span className="nav-indicator"></span>
        </button>
        <button 
          className="nav-btn add-btn"
          onClick={() => { navigateToSection("schedule", "left"); }}
        >
          <span className="add-icon">+</span>
        </button>
        <button 
          className={`nav-btn ${activeSection === "users" ? "active" : ""}`}
          onClick={() => navigateToSection("users", "left")}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-label">Users</span>
          <span className="nav-indicator"></span>
        </button>
        <button 
          className={`nav-btn ${activeSection === "profile" ? "active" : ""}`}
          onClick={() => navigateToSection("profile", "left")}
        >
          <span className="nav-icon">👤</span>
          <span className="nav-label">Profile</span>
          <span className="nav-indicator"></span>
        </button>
      </nav>

      <style jsx>{`
        .admin-page {
          display: flex;
          min-height: 100vh;
          background: linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%);
        }

        /* Slide Animations */
        .slide-left {
          animation: slideOutLeft 0.15s ease-out forwards;
        }
        .slide-right {
          animation: slideOutRight 0.15s ease-out forwards;
        }
        @keyframes slideOutLeft {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-100%); opacity: 0; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        /* Mobile Bottom Navigation */
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 80px;
          background: white;
          box-shadow: 0 -8px 32px rgba(0,0,0,0.12);
          z-index: 100;
          padding: 0 8px;
          padding-bottom: env(safe-area-inset-bottom);
          border-radius: 24px 24px 0 0;
        }

        .nav-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 8px 0;
        }

        .nav-btn .nav-icon {
          font-size: 1.5rem;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .nav-btn .nav-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.8;
        }

        .nav-btn .nav-indicator {
          position: absolute;
          bottom: 4px;
          width: 4px;
          height: 4px;
          background: transparent;
          border-radius: 50%;
          transition: all 0.3s;
        }

        .nav-btn.active {
          color: #667eea;
        }

        .nav-btn.active .nav-icon {
          transform: scale(1.2) translateY(-2px);
        }

        .nav-btn.active .nav-indicator {
          width: 24px;
          height: 4px;
          border-radius: 2px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        /* Center Add Button */
        .nav-btn.add-btn {
          position: relative;
          margin-top: -30px;
        }

        .add-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 2rem;
          font-weight: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .nav-btn.add-btn:active .add-icon {
          transform: scale(0.9);
        }

        /* Refresh Button */
        .refresh-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 1.25rem;
          transition: all 0.3s;
        }

        .refresh-btn:active {
          transform: scale(0.9);
        }

        .refresh-btn.spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Mobile Full Section Screens */
        .mobile-full-section {
          min-height: calc(100vh - 140px);
          animation: slideInLeft 0.3s ease-out;
          padding-bottom: 140px;
        }

        .section-header-mobile {
          display: none;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: white;
          border-radius: 16px;
          margin-bottom: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .back-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:active {
          transform: scale(0.95);
        }

        .section-header-mobile h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #1e293b;
        }

        /* Profile Screen Styles */
        .profile-screen .profile-content {
          padding: 0;
          padding-bottom: 20px;
        }

        .profile-card-large {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 32px;
          text-align: center;
          border-radius: 20px;
          margin-bottom: 20px;
          color: white;
        }

        .profile-avatar-large {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          font-weight: 700;
          margin: 0 auto 16px;
        }

        .profile-card-large h3 {
          margin: 0 0 8px;
          font-size: 1.5rem;
        }

        .profile-info-list {
          background: white;
          border-radius: 16px;
          padding: 8px;
          margin-bottom: 16px;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-icon {
          font-size: 1.5rem;
        }

        .info-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .info-label {
          font-size: 12px;
          color: #64748b;
        }

        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .settings-card {
          background: white;
          border-radius: 16px;
          padding: 8px;
          margin-bottom: 16px;
        }

        .settings-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
        }

        .settings-icon {
          font-size: 1.5rem;
        }

        .settings-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .settings-title {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .settings-desc {
          font-size: 12px;
          color: #64748b;
        }

        /* Profile Menu */
        .profile-menu {
          background: white;
          border-radius: 16px;
          padding: 8px;
          margin-bottom: 16px;
        }

        .menu-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          padding: 8px 16px;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          padding: 16px;
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 12px;
        }

        .menu-item:active {
          background: #f1f5f9;
        }

        .menu-icon {
          font-size: 1.5rem;
        }

        .menu-text {
          flex: 1;
          text-align: left;
          font-size: 16px;
          font-weight: 500;
          color: #1e293b;
        }

        .menu-arrow {
          color: #94a3b8;
          font-size: 1.25rem;
        }

        /* Input Styles */
        .input-readonly {
          background: #f1f5f9 !important;
          color: #64748b !important;
          cursor: not-allowed;
        }

        .input-hint {
          display: block;
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .btn-logout-full {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-logout-full:active {
          transform: scale(0.98);
        }

        /* Mobile Header */
        .mobile-header {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
          color: white;
          padding: 0 16px;
          align-items: center;
          justify-content: space-between;
          z-index: 90;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .menu-btn {
          width: 40px;
          height: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          padding: 8px;
        }

        .menu-btn span {
          display: block;
          width: 22px;
          height: 2px;
          background: white;
          border-radius: 2px;
        }

        .mobile-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .mobile-time {
          font-weight: 600;
          font-size: 0.9rem;
          background: rgba(255,255,255,0.15);
          padding: 6px 12px;
          border-radius: 20px;
        }

        /* Menu Overlay */
        .menu-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 95;
        }

        /* Sidebar */
        .sidebar {
          width: 260px;
          background: linear-gradient(180deg, #1a365d 0%, #2c5282 100%);
          color: white;
          display: flex;
          flex-direction: column;
          position: fixed;
          height: 100vh;
          z-index: 100;
          transition: transform 0.3s ease;
        }

        .sidebar-header-mobile {
          display: none;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .close-menu-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
        }

        .sidebar-brand {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .brand-icon {
          font-size: 1.5rem;
        }

        .brand-text {
          font-weight: 700;
          font-size: 1.1rem;
        }

        .sidebar-nav {
          padding: 16px 12px;
          flex: 1;
          overflow-y: auto;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          margin-bottom: 4px;
          transition: all 0.2s;
          font-size: 15px;
        }

        .nav-icon {
          font-size: 1.25rem;
          width: 28px;
          text-align: center;
        }

        .nav-item:hover,
        .nav-item.active {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .time-display {
          text-align: center;
          margin-bottom: 12px;
          padding: 12px;
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }

        .time-label {
          display: block;
          font-size: 10px;
          opacity: 0.7;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .time-value {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .btn-logout {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.3);
          color: white;
        }

        /* Main Content */
        .main-content {
          flex: 1;
          margin-left: 260px;
          padding: 24px;
        }

        .top-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .top-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a365d;
          margin: 0;
        }

        .countdown-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 12px 20px;
          border-radius: 12px;
          color: white;
        }

        .countdown-icon {
          font-size: 1.5rem;
        }

        .countdown-label {
          display: block;
          font-size: 10px;
          opacity: 0.8;
          text-transform: uppercase;
        }

        .countdown-value {
          font-size: 1.25rem;
          font-weight: 700;
          font-family: monospace;
        }

        /* Toast */
        .toast-message {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 14px 24px;
          background: #1a365d;
          color: white;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          cursor: pointer;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }

        .stat-icon {
          font-size: 2rem;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }

        .stat-purple .stat-icon {
          background: #e9d8fd;
        }
        .stat-green .stat-icon {
          background: #c6f6d5;
        }
        .stat-blue .stat-icon {
          background: #bee3f8;
        }
        .stat-orange .stat-icon {
          background: #feebc8;
        }

        .stat-value {
          display: block;
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a365d;
        }

        .stat-label {
          font-size: 13px;
          color: #718096;
        }

        /* Content Grid */
        .content-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        /* Panels */
        .panel {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
          margin-bottom: 20px;
        }

        .panel-wide {
          grid-column: 1 / -1;
        }

        .panel-accent {
          border-left: 4px solid #667eea;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .panel-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1a365d;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }

        .title-icon {
          font-size: 1.25rem;
        }

        .schedule-label {
          margin-left: 12px;
          padding: 4px 12px;
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .panel-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Forms */
        .compact-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .input {
          padding: 10px 14px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
          transition: all 0.2s;
          background: #f7fafc;
        }

        .input:focus {
          outline: none;
          border-color: #667eea;
          background: white;
        }

        .settings-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .settings-row:last-child {
          border-bottom: none;
        }

        .settings-row label {
          font-weight: 500;
          color: #4a5568;
        }

        .input-group {
          display: flex;
          gap: 8px;
        }

        .input-group .input {
          width: 140px;
        }

        /* Buttons */
        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: #e2e8f0;
          color: #4a5568;
        }

        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-success {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
        }

        .btn-danger {
          background: #fc8181;
          color: white;
        }

        .btn-ghost {
          background: transparent;
        }

        .btn-outline {
          background: transparent;
          border: 2px solid #e2e8f0;
        }

        .btn-block {
          width: 100%;
        }

        .btn-lg {
          padding: 14px 24px;
          font-size: 15px;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }

        .btn-xs {
          padding: 4px 8px;
          font-size: 11px;
        }

        .btn-icon {
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        }

        /* Badge */
        .badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          background: #e2e8f0;
          color: #4a5568;
        }

        /* Users List */
        .bulk-bar {
          display: flex;
          gap: 8px;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 12px;
        }

        .users-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .user-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .user-row:hover {
          background: #f7fafc;
        }

        .user-row.inactive {
          opacity: 0.5;
        }

        .user-info {
          flex: 1;
        }

        .user-name {
          display: block;
          font-weight: 600;
          color: #1a365d;
        }

        .user-phone {
          font-size: 12px;
          color: #718096;
        }

        .role-badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .role-badge.admin {
          background: #e9d8fd;
          color: #6b46c1;
        }

        .role-badge.officer {
          background: #bee3f8;
          color: #2b6cb0;
        }

        /* Toggle */
        .toggle {
          position: relative;
          width: 40px;
          height: 22px;
        }

        .toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #cbd5e0;
          border-radius: 22px;
          transition: 0.3s;
        }

        .toggle-slider:before {
          content: "";
          position: absolute;
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background: white;
          border-radius: 50%;
          transition: 0.3s;
        }

        .toggle input:checked + .toggle-slider {
          background: #48bb78;
        }

        .toggle input:checked + .toggle-slider:before {
          transform: translateX(18px);
        }

        /* Pattern Types */
        .pattern-types {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }

        .pattern-type-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 12px;
          font-weight: 600;
        }

        .pattern-type-btn span:first-child {
          font-size: 1.25rem;
        }

        .pattern-type-btn.yellow.active {
          border-color: #d69e2e;
          background: #fefcbf;
        }
        .pattern-type-btn.blue.active {
          border-color: #3182ce;
          background: #bee3f8;
        }
        .pattern-type-btn.pink.active {
          border-color: #d53f8c;
          background: #fed7e2;
        }
        .pattern-type-btn.green.active {
          border-color: #38a169;
          background: #c6f6d5;
        }

        .shift-type-row {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .shift-btn {
          flex: 1;
          padding: 8px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .shift-btn.active {
          border-color: #667eea;
          background: #ebf4ff;
        }

        .date-range-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .date-input label {
          display: block;
          font-size: 12px;
          color: #718096;
          margin-bottom: 4px;
        }

        /* Selection Sections */
        .selection-section {
          margin-bottom: 16px;
        }

        .selection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-weight: 600;
          color: #4a5568;
        }

        .checkbox-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .checkbox-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #f7fafc;
          border: 2px solid #e2e8f0;
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .checkbox-chip input {
          display: none;
        }

        .checkbox-chip.checked {
          background: #ebf4ff;
          border-color: #667eea;
          color: #667eea;
        }

        .days-row {
          display: flex;
          gap: 6px;
        }

        .day-btn {
          flex: 1;
          padding: 10px 4px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .day-btn.active {
          background: #667eea;
          border-color: #667eea;
          color: white;
        }

        /* Collapsible Table */
        .collapsible-table {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .day-row {
          border-bottom: 1px solid #e2e8f0;
        }

        .day-row:last-child {
          border-bottom: none;
        }

        .day-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .day-header:hover {
          background: #f7fafc;
        }

        .day-name {
          font-weight: 600;
          color: #1a365d;
          width: 100px;
        }

        .day-badges {
          flex: 1;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .mini-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .mini-badge.yellow {
          background: #fefcbf;
          color: #975a16;
        }
        .mini-badge.blue {
          background: #bee3f8;
          color: #2c5282;
        }
        .mini-badge.pink {
          background: #fed7e2;
          color: #97266d;
        }
        .mini-badge.green {
          background: #c6f6d5;
          color: #276749;
        }
        .mini-badge.gray {
          background: #edf2f7;
          color: #718096;
        }

        .expand-icon {
          color: #a0aec0;
          font-size: 10px;
        }

        .day-content {
          padding: 12px 16px;
          background: #f7fafc;
          border-top: 1px solid #e2e8f0;
        }

        .pattern-group {
          padding: 8px 12px;
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .pattern-group:last-child {
          margin-bottom: 0;
        }

        .pattern-group.yellow {
          background: #fefcbf;
        }
        .pattern-group.blue {
          background: #bee3f8;
        }
        .pattern-group.pink {
          background: #fed7e2;
        }
        .pattern-group.green {
          background: #c6f6d5;
        }

        .group-label {
          font-weight: 600;
          font-size: 12px;
          display: block;
          margin-bottom: 4px;
        }

        .group-names {
          font-size: 13px;
          color: #4a5568;
        }

        /* Officer Tags with Delete */
        .officer-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .officer-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px 4px 10px;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 16px;
          font-size: 13px;
          color: #2d3748;
        }

        .tag-delete {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          padding: 0;
          border: none;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.15);
          color: #4a5568;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tag-delete:hover {
          background: #e53e3e;
          color: white;
        }

        /* Available Officers Box */
        .available-officers-box {
          background: linear-gradient(135deg, #e6fffa 0%, #b2f5ea 100%);
          border: 2px solid #38b2ac;
          border-radius: 12px;
          padding: 16px;
        }

        .available-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .available-icon {
          font-size: 1.25rem;
        }

        .available-label {
          font-weight: 600;
          color: #234e52;
          flex: 1;
        }

        .available-count {
          background: #319795;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 14px;
        }

        .available-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
          max-height: 120px;
          overflow-y: auto;
        }

        .available-officer {
          background: white;
          padding: 4px 10px;
          border-radius: 16px;
          font-size: 12px;
          color: #234e52;
          border: 1px solid #b2f5ea;
        }

        .available-formula {
          font-size: 12px;
          color: #285e61;
          background: rgba(255, 255, 255, 0.5);
          padding: 8px 12px;
          border-radius: 8px;
          text-align: center;
          font-weight: 600;
        }

        /* Schedule Section - Smart Flow Design */
        .schedule-flow {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 24px;
        }

        .date-selector-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          color: white;
        }

        .date-selector-icon {
          font-size: 2.5rem;
        }

        .date-selector-content {
          flex: 1;
        }

        .date-selector-content label {
          display: block;
          font-size: 12px;
          opacity: 0.9;
          margin-bottom: 4px;
        }

        .date-selector-content .input {
          background: rgba(255,255,255,0.95);
          border: none;
          font-weight: 600;
        }

        .date-status {
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .date-status.has-schedule {
          background: #c6f6d5;
          color: #22543d;
        }

        .date-status.past {
          background: #fed7d7;
          color: #822727;
        }

        .date-status.future {
          background: #bee3f8;
          color: #2a4365;
        }

        .existing-schedule-view {
          margin-bottom: 16px;
        }

        .schedule-status-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-radius: 12px;
        }

        .schedule-status-bar.success {
          background: linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%);
          border: 1px solid #68d391;
        }

        .status-icon {
          font-size: 1.5rem;
        }

        .status-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .status-text {
          font-weight: 500;
          color: #22543d;
        }

        .status-meta {
          font-size: 12px;
          color: #38a169;
          opacity: 0.9;
        }

        .schedule-actions {
          display: flex;
          gap: 12px;
          margin-top: 12px;
        }

        .schedule-actions .btn-whatsapp {
          flex: 1;
          padding: 12px 20px;
          font-size: 15px;
        }

        .schedule-actions .btn-danger {
          padding: 12px 16px;
        }

        .btn-sm {
          padding: 8px 16px;
          font-size: 13px;
        }

        .no-schedule-past {
          padding: 20px;
        }

        .empty-state-card {
          text-align: center;
          padding: 40px 20px;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-radius: 16px;
          border: 2px dashed #f6ad55;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }

        .empty-state-card h3 {
          margin: 0 0 8px;
          color: #744210;
        }

        .empty-state-card p {
          margin: 0;
          color: #975a16;
        }

        .create-schedule-view {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .config-section {
          background: white;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid #e2e8f0;
        }

        .config-title {
          margin: 0 0 16px;
          font-size: 14px;
          color: #4a5568;
          font-weight: 600;
        }

        .generate-section {
          padding: 20px;
          background: linear-gradient(135deg, #e6fffa 0%, #b2f5ea 100%);
          border-radius: 16px;
          border: 1px solid #81e6d9;
        }

        .generate-section .btn {
          margin-bottom: 8px;
        }

        .hint-text {
          text-align: center;
          font-size: 13px;
          color: #718096;
          margin: 0;
        }

        .btn-lg {
          padding: 16px 24px;
          font-size: 16px;
          font-weight: 600;
        }

        .input-lg {
          padding: 14px 16px;
          font-size: 16px;
          border-radius: 12px;
        }

        .unified-limits {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .limit-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-radius: 16px;
          background: white;
          border: 2px solid #e2e8f0;
        }

        .limit-card.morning {
          border-color: #f6e05e;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
        }

        .limit-card.afternoon {
          border-color: #f6ad55;
          background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
        }

        .limit-icon {
          font-size: 2rem;
        }

        .limit-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .limit-info label {
          font-size: 12px;
          color: #718096;
          font-weight: 500;
        }

        .limit-info .input {
          padding: 10px 12px;
          font-size: 18px;
          font-weight: 600;
          text-align: center;
        }

        .unified-available {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
          border-radius: 12px;
          border: 1px solid #9ae6b4;
        }

        .available-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 16px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .badge-count {
          font-size: 1.75rem;
          font-weight: 700;
          color: #38a169;
        }

        .badge-label {
          font-size: 11px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .available-suggestion {
          flex: 1;
          font-size: 13px;
          color: #4a5568;
        }

        .unified-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .btn-block {
          width: 100%;
          padding: 16px;
          font-size: 16px;
          font-weight: 600;
        }

        .secondary-actions {
          display: flex;
          gap: 12px;
        }

        .secondary-actions .btn {
          flex: 1;
          padding: 12px;
        }

        .btn-outline {
          background: white;
          border: 2px solid #e2e8f0;
          color: #4a5568;
        }

        .btn-outline:hover {
          border-color: #cbd5e0;
          background: #f7fafc;
        }

        .btn-outline.btn-danger {
          border-color: #feb2b2;
          color: #e53e3e;
        }

        .btn-outline.btn-danger:hover {
          background: #fff5f5;
          border-color: #fc8181;
        }

        /* Legacy schedule controls (hidden) */
        .schedule-controls {
          display: none;
        }

        .rule-config {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }

        .rule-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rule-item label {
          font-size: 12px;
          color: #718096;
        }

        .schedule-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .schedule-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
        }

        .schedule-column {
          border-radius: 12px;
          overflow: hidden;
        }

        .schedule-column.morning {
          background: linear-gradient(180deg, #fefcbf 0%, #faf089 100%);
        }
        .schedule-column.afternoon {
          background: linear-gradient(180deg, #fbd38d 0%, #f6ad55 100%);
        }
        .schedule-column.fulltime {
          background: linear-gradient(180deg, #bee3f8 0%, #90cdf4 100%);
        }
        .schedule-column.dayoff {
          background: linear-gradient(180deg, #e2e8f0 0%, #cbd5e0 100%);
        }
        .schedule-column.vacation {
          background: linear-gradient(180deg, #c6f6d5 0%, #9ae6b4 100%);
        }

        .column-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          font-weight: 600;
          font-size: 12px;
        }

        .column-icon {
          font-size: 1.25rem;
        }

        .column-count {
          margin-left: auto;
          background: rgba(0, 0, 0, 0.1);
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
        }

        .column-list {
          padding: 8px;
          min-height: 100px;
        }

        .shift-item {
          background: rgba(255, 255, 255, 0.8);
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 6px;
          font-size: 13px;
        }

        .empty-text {
          text-align: center;
          color: rgba(0, 0, 0, 0.4);
          font-size: 12px;
          padding: 20px;
        }

        /* WhatsApp */
        .whatsapp-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .whatsapp-box {
          background: #1a365d;
          color: #e2e8f0;
          padding: 20px;
          border-radius: 12px;
          font-family: monospace;
          font-size: 13px;
          white-space: pre-wrap;
          line-height: 1.6;
        }

        /* Share as Image Section - Exciting Design */
        .share-image-section {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 20px;
          position: relative;
          overflow: hidden;
        }

        .share-image-section::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 50%);
          animation: shimmer 8s ease-in-out infinite;
        }

        @keyframes shimmer {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(25%, 25%); }
        }

        .share-image-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }

        .share-icon-wrapper {
          flex-shrink: 0;
        }

        .share-icon-bg {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.75rem;
          box-shadow: 0 8px 24px rgba(249, 115, 22, 0.4);
          animation: iconFloat 3s ease-in-out infinite;
        }

        @keyframes iconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        .share-header-text h2 {
          color: white;
          font-size: 20px;
          font-weight: 700;
          margin: 0;
        }

        .share-header-text p {
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          margin: 4px 0 0;
        }

        .share-actions-row {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }

        .btn-share-primary,
        .btn-share-secondary {
          flex: 1;
          padding: 14px 16px;
          border: none;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .btn-share-primary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
        }

        .btn-share-primary:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 10px 30px rgba(16, 185, 129, 0.5);
        }

        .btn-share-secondary {
          background: rgba(255, 255, 255, 0.15);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
        }

        .btn-share-secondary:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-3px) scale(1.02);
        }

        .btn-icon {
          font-size: 18px;
        }

        .btn-text {
          font-size: 13px;
        }

        .schedule-card-wrapper {
          position: relative;
          z-index: 1;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 
            0 20px 60px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1);
        }

        .schedule-image-card {
          background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
          border-radius: 20px;
          overflow: hidden;
        }

        .img-card-header {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%);
          padding: 24px 20px;
          text-align: center;
          position: relative;
        }

        .img-card-header::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: linear-gradient(to top, rgba(15, 23, 42, 0.5), transparent);
        }

        .img-card-logo {
          width: 64px;
          height: 64px;
          margin: 0 auto 12px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .img-card-title {
          font-size: 22px;
          font-weight: 800;
          color: white;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }

        .img-card-subtitle {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          margin-top: 4px;
          font-style: italic;
        }

        .img-card-date {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
          padding: 16px;
          text-align: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .img-date-day {
          font-size: 12px;
          color: #60a5fa;
          font-weight: 700;
          letter-spacing: 3px;
          margin-bottom: 4px;
        }

        .img-date-full {
          font-size: 20px;
          font-weight: 700;
          color: white;
        }

        .img-card-body {
          padding: 16px;
        }

        .img-shift-block {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.2s ease;
        }

        .img-shift-block.morning {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.05) 100%);
          border-left: 4px solid #fbbf24;
        }

        .img-shift-block.afternoon {
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(249, 115, 22, 0.05) 100%);
          border-left: 4px solid #f97316;
        }

        .img-shift-block.fulltime {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%);
          border-left: 4px solid #3b82f6;
        }

        .img-shift-block.dayoff {
          background: linear-gradient(135deg, rgba(148, 163, 184, 0.15) 0%, rgba(148, 163, 184, 0.05) 100%);
          border-left: 4px solid #94a3b8;
        }

        .img-shift-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .img-shift-icon {
          font-size: 20px;
        }

        .img-shift-title {
          font-weight: 700;
          color: white;
          font-size: 14px;
          flex: 1;
        }

        .img-shift-badge {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .img-shift-officers {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .img-officer {
          background: rgba(255, 255, 255, 0.1);
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .img-no-schedule {
          text-align: center;
          padding: 40px 20px;
        }

        .img-no-icon {
          font-size: 3rem;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .img-no-text {
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }

        .img-card-footer {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%);
          padding: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .img-footer-stats {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-bottom: 12px;
        }

        .img-stat {
          text-align: center;
        }

        .img-stat-icon {
          display: block;
          font-size: 16px;
          margin-bottom: 2px;
        }

        .img-stat-value {
          display: block;
          font-size: 20px;
          font-weight: 800;
          color: white;
        }

        .img-stat-label {
          display: block;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .img-footer-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .brand-icon {
          font-size: 16px;
        }

        .brand-text {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          font-weight: 500;
          letter-spacing: 0.5px;
        }

        /* Legacy compatibility */
        .shift-names {
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.875rem;
          line-height: 1.6;
        }

        .officer-name {
          color: rgba(255, 255, 255, 0.9);
        }

        .card-footer {
          background: rgba(0, 0, 0, 0.3);
          padding: 16px;
          text-align: center;
        }

        .card-summary {
          display: flex;
          justify-content: center;
          gap: 12px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.875rem;
          margin-bottom: 8px;
        }

        .card-watermark {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
        }

        .card-no-schedule {
          text-align: center;
          padding: 32px 16px;
        }

        .no-schedule-icon {
          font-size: 3rem;
          margin-bottom: 12px;
        }

        .no-schedule-text {
          color: rgba(255, 255, 255, 0.6);
          font-size: 1rem;
        }

        .badge-blue {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
        }

        .whatsapp-panel {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          border: 2px solid #22c55e;
        }

        .whatsapp-quick-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .btn-whatsapp {
          flex: 1;
          min-width: 180px;
          padding: 16px 24px;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-whatsapp:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
        }

        .btn-whatsapp-outline {
          flex: 1;
          min-width: 180px;
          padding: 16px 24px;
          background: white;
          color: #16a34a;
          border: 2px solid #22c55e;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-whatsapp-outline:hover {
          background: #f0fdf4;
          transform: translateY(-2px);
        }

        .whatsapp-preview {
          margin-top: 16px;
          background: #1a365d;
          color: #e2e8f0;
          padding: 16px;
          border-radius: 12px;
          font-family: monospace;
          font-size: 12px;
          white-space: pre-wrap;
          line-height: 1.6;
          max-height: 200px;
          overflow-y: auto;
        }

        .badge-green {
          background: #22c55e;
          color: white;
        }

        /* Activity Panel */
        .activity-panel {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1px solid #0ea5e9;
        }

        .activity-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .activity-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .activity-icon {
          font-size: 1.5rem;
        }

        .activity-info {
          flex: 1;
        }

        .activity-label {
          display: block;
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
        }

        .activity-value {
          font-weight: 600;
          color: #0f172a;
          font-size: 14px;
        }

        .countdown-text {
          font-family: monospace;
          font-size: 16px;
          color: #059669;
        }

        .hidden-section {
          display: none !important;
        }

        .back-to-dashboard {
          display: block;
          width: 100%;
          padding: 16px;
          margin-bottom: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-to-dashboard:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        /* Pattern Form Grid */
        .pattern-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 16px;
        }

        /* Settings Grid */
        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 20px;
          width: 100%;
          max-width: 420px;
          max-height: 90vh;
          overflow-y: auto;
          animation: modalIn 0.3s ease;
        }

        @keyframes modalIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-header h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1a365d;
          margin: 0;
        }

        .close-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f7fafc;
          border: none;
          border-radius: 10px;
          font-size: 1.25rem;
          cursor: pointer;
          color: #718096;
        }

        .close-btn:hover {
          background: #edf2f7;
          color: #1a365d;
        }

        /* Profile Modal */
        .profile-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 24px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .profile-avatar {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.75rem;
          font-weight: 700;
        }

        .profile-info h3 {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0 0 6px 0;
        }

        .profile-info .role-badge {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .profile-details {
          padding: 20px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-label {
          color: #718096;
          font-size: 14px;
        }

        .detail-value {
          font-weight: 600;
          color: #1a365d;
        }

        .status-active {
          color: #38a169;
        }

        /* Biometric Section */
        .biometric-section {
          margin: 0 20px 20px;
          padding: 16px;
          background: linear-gradient(135deg, #e6fffa 0%, #b2f5ea 100%);
          border-radius: 12px;
          border: 2px solid #38b2ac;
        }

        .biometric-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .biometric-icon {
          font-size: 2rem;
        }

        .biometric-info {
          flex: 1;
        }

        .biometric-title {
          display: block;
          font-weight: 600;
          color: #234e52;
        }

        .biometric-desc {
          font-size: 12px;
          color: #285e61;
        }

        .biometric-note {
          margin: 12px 0 0;
          font-size: 13px;
          color: #285e61;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 8px;
        }

        .biometric-unsupported {
          margin: 0 20px 20px;
          padding: 16px;
          background: #f7fafc;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #718096;
          font-size: 14px;
        }

        .biometric-unsupported span:first-child {
          font-size: 1.5rem;
        }

        .profile-actions {
          padding: 0 20px 20px;
        }

        /* Brand New Dashboard - Fresh Color Palette */
        .dash-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .dash-box {
          position: relative;
          background: white;
          border-radius: 24px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        }

        .dash-box::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: none;
        }

        .dash-box.indigo::before { background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(79, 70, 229, 0.05)); }
        .dash-box.teal::before { background: linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(13, 148, 136, 0.05)); }
        .dash-box.rose::before { background: linear-gradient(135deg, rgba(244, 63, 94, 0.1), rgba(225, 29, 72, 0.05)); }
        .dash-box.amber::before { background: linear-gradient(135deg, rgba(251, 146, 60, 0.1), rgba(249, 115, 22, 0.05)); }

        .dash-box:hover::before { opacity: 1; }

        .dash-box:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
        }

        .dash-box:active { transform: translateY(-4px) scale(0.98); }

        .box-pattern {
          position: absolute;
          top: 0;
          right: 0;
          width: 100px;
          height: 100px;
          opacity: 0.03;
          background: radial-gradient(circle, currentColor 1px, transparent 1px);
          background-size: 10px 10px;
        }

        .dash-box.indigo { border-top: 3px solid #6366f1; }
        .dash-box.teal { border-top: 3px solid #14b8a6; }
        .dash-box.rose { border-top: 3px solid #f43f5e; }
        .dash-box.amber { border-top: 3px solid #fb923c; }

        .box-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          position: relative;
        }

        .box-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .dash-box.indigo .box-icon-wrapper { background: linear-gradient(135deg, #eef2ff, #e0e7ff); }
        .dash-box.teal .box-icon-wrapper { background: linear-gradient(135deg, #f0fdfa, #ccfbf1); }
        .dash-box.rose .box-icon-wrapper { background: linear-gradient(135deg, #fff1f2, #ffe4e6); }
        .dash-box.amber .box-icon-wrapper { background: linear-gradient(135deg, #fffbeb, #fef3c7); }

        .box-icon { font-size: 1.75rem; }

        .box-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 32px;
          height: 32px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          font-size: 16px;
          font-weight: 800;
          color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .dash-box.indigo .box-badge { background: linear-gradient(135deg, #6366f1, #4f46e5); }
        .dash-box.teal .box-badge { background: linear-gradient(135deg, #14b8a6, #0d9488); }
        .dash-box.rose .box-badge { background: linear-gradient(135deg, #f43f5e, #e11d48); }
        .dash-box.amber .box-badge { background: linear-gradient(135deg, #fb923c, #f97316); }

        .box-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .box-desc {
          font-size: 12px;
          color: #64748b;
          margin: 0 0 14px 0;
        }

        .box-stats {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .stat-item.active { background: linear-gradient(135deg, #d1fae5, #a7f3d0); }
        .stat-item.inactive { background: linear-gradient(135deg, #fecaca, #fca5a5); }

        .stat-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .stat-item.active .stat-indicator { background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2); }
        .stat-item.inactive .stat-indicator { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2); }

        .stat-label {
          flex: 1;
          font-size: 12px;
          font-weight: 600;
        }

        .stat-item.active .stat-label { color: #065f46; }
        .stat-item.inactive .stat-label { color: #991b1b; }

        .stat-value {
          font-size: 16px;
          font-weight: 800;
        }

        .stat-item.active .stat-value { color: #047857; }
        .stat-item.inactive .stat-value { color: #b91c1c; }

        .box-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .grid-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 8px;
          border-radius: 12px;
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
        }

        .cell-icon { font-size: 18px; }
        .cell-num { font-size: 20px; font-weight: 800; color: #0f172a; }
        .cell-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; }

        .box-progress {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .progress-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
        }

        .progress-bar {
          height: 8px;
          background: #f1f5f9;
          border-radius: 10px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #f43f5e, #e11d48);
          border-radius: 10px;
          transition: width 0.6s ease;
        }

        .box-distribution {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dist-col {
          flex: 1;
          text-align: center;
        }

        .dist-value {
          font-size: 32px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1;
        }

        .dist-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-size: 11px;
          color: #64748b;
          margin-top: 6px;
          font-weight: 600;
        }

        .dist-icon { font-size: 14px; }

        .dist-percent {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .dist-divider {
          display: flex;
          align-items: center;
        }

        .divider-line {
          width: 2px;
          height: 50px;
          background: linear-gradient(180deg, transparent, #e5e7eb, transparent);
        }

        /* Info Panel */
        .info-panel {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }

        .panel-item {
          background: white;
          border-radius: 16px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
          border: 1px solid #f1f5f9;
        }

        .panel-item.highlight {
          background: linear-gradient(135deg, #fffbeb, #fef3c7);
          border-color: #fbbf24;
        }

        .panel-icon {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .time-icon { background: linear-gradient(135deg, #dbeafe, #bfdbfe); }
        .auto-icon { background: linear-gradient(135deg, #fef3c7, #fde68a); }
        .date-icon { background: linear-gradient(135deg, #e0e7ff, #c7d2fe); }

        .panel-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .panel-label {
          font-size: 9px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .panel-value {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        .panel-item.highlight .panel-label { color: #92400e; }
        .panel-item.highlight .panel-value { color: #78350f; }

        /* Action Panel */
        .action-panel {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }

        .action-button {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 16px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .action-button:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
        }

        .action-button:active { transform: translateY(-2px) scale(0.96); }

        .action-button.primary {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border-color: #2563eb;
        }

        .action-button.success {
          background: linear-gradient(135deg, #10b981, #059669);
          border-color: #059669;
        }

        .action-button.secondary {
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          border-color: #e5e7eb;
        }

        .action-icon {
          font-size: 24px;
        }

        .action-text {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .action-title {
          font-size: 12px;
          font-weight: 700;
        }

        .action-button.primary .action-title,
        .action-button.success .action-title { color: white; }

        .action-button.secondary .action-title { color: #0f172a; }

        .action-subtitle {
          font-size: 9px;
          font-weight: 500;
        }

        .action-button.primary .action-subtitle,
        .action-button.success .action-subtitle { color: rgba(255, 255, 255, 0.8); }

        .action-button.secondary .action-subtitle { color: #64748b; }

        /* Clean Schedule Card */
        .schedule-card-container { margin-bottom: 16px; }

        .schedule-card {
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          border: 1px solid #e5e7eb;
        }

        .sc-header {
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .sc-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .sc-logo {
          width: 42px;
          height: 42px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
        }

        .sc-title strong {
          display: block;
          font-size: 15px;
          color: #1e293b;
        }
        .sc-title span {
          font-size: 11px;
          color: #64748b;
        }

        .sc-date {
          background: white;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
        }

        .sc-day {
          font-size: 13px;
          font-weight: 700;
          color: #3b82f6;
        }
        .sc-fulldate {
          font-size: 11px;
          color: #64748b;
        }

        .sc-body { padding: 12px; }

        .sc-shift {
          background: #f8fafc;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 10px;
          border-left: 4px solid;
        }

        .sc-shift.morning { border-color: #f59e0b; background: linear-gradient(90deg, #fffbeb, #f8fafc); }
        .sc-shift.afternoon { border-color: #f97316; background: linear-gradient(90deg, #fff7ed, #f8fafc); }
        .sc-shift.fulltime { border-color: #3b82f6; background: linear-gradient(90deg, #eff6ff, #f8fafc); }
        .sc-shift.dayoff { border-color: #94a3b8; background: linear-gradient(90deg, #f1f5f9, #f8fafc); }

        .sc-shift-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .sc-shift-icon { font-size: 20px; }

        .sc-shift-info {
          flex: 1;
        }
        .sc-shift-info strong {
          display: block;
          font-size: 13px;
          color: #1e293b;
        }
        .sc-shift-info span {
          font-size: 10px;
          color: #64748b;
        }

        .sc-shift-count {
          min-width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: white;
          background: #3b82f6;
          border-radius: 8px;
        }

        .sc-shift.morning .sc-shift-count { background: #f59e0b; }
        .sc-shift.afternoon .sc-shift-count { background: #f97316; }
        .sc-shift.fulltime .sc-shift-count { background: #3b82f6; }
        .sc-shift.dayoff .sc-shift-count { background: #94a3b8; }

        .sc-names {
          font-size: 12px;
          color: #475569;
          line-height: 1.6;
        }

        .sc-empty {
          text-align: center;
          padding: 30px;
          color: #94a3b8;
        }
        .sc-empty-icon {
          font-size: 36px;
          display: block;
          margin-bottom: 8px;
        }

        .sc-footer {
          background: #f8fafc;
          padding: 12px 16px;
          border-top: 1px solid #e5e7eb;
        }

        .sc-summary {
          display: flex;
          justify-content: center;
          gap: 20px;
        }

        .sc-sum-item {
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 8px;
        }
        .sc-sum-item strong { font-size: 14px; margin-right: 4px; }
        .sc-sum-item.working { background: #dcfce7; color: #166534; }
        .sc-sum-item.off { background: #f1f5f9; color: #475569; }
        .sc-sum-item.total { background: #dbeafe; color: #1e40af; }

        .hidden { display: none !important; }

        /* Legacy compatibility */
        .dayoff-bar { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
        .fulltime-bar { background: linear-gradient(90deg, #3b82f6, #2563eb); }
        .vacation-bar { background: linear-gradient(90deg, #10b981, #059669); }

        .pattern-label {
          position: relative;
          flex: 1;
          font-size: 13px;
          color: #475569;
          z-index: 1;
        }

        .pattern-value {
          position: relative;
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
          z-index: 1;
        }

        /* Available Card Hero */
        .available-hero {
          text-align: center;
          margin-bottom: 16px;
        }

        .available-ring {
          width: 100px;
          height: 100px;
          margin: 0 auto 12px;
          border-radius: 50%;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 0 0 8px rgba(251, 191, 36, 0.2),
            0 0 0 16px rgba(251, 191, 36, 0.1),
            0 8px 24px rgba(251, 191, 36, 0.4);
          animation: ringPulse 3s ease-in-out infinite;
        }

        @keyframes ringPulse {
          0%, 100% { box-shadow: 0 0 0 8px rgba(251, 191, 36, 0.2), 0 0 0 16px rgba(251, 191, 36, 0.1), 0 8px 24px rgba(251, 191, 36, 0.4); }
          50% { box-shadow: 0 0 0 12px rgba(251, 191, 36, 0.3), 0 0 0 24px rgba(251, 191, 36, 0.15), 0 12px 32px rgba(251, 191, 36, 0.5); }
        }

        .available-number {
          font-size: 36px;
          font-weight: 800;
          color: white;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .available-label {
          font-size: 14px;
          font-weight: 600;
          color: #92400e;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .distribution-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 12px;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border-radius: 16px;
          margin-bottom: 16px;
        }

        .distribution-item {
          text-align: center;
          flex: 1;
        }

        .distribution-icon {
          font-size: 24px;
          margin-bottom: 4px;
        }

        .distribution-value {
          font-size: 24px;
          font-weight: 800;
          color: #1e293b;
        }

        .distribution-label {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
        }

        .distribution-percent {
          font-size: 10px;
          color: #f59e0b;
          font-weight: 600;
        }

        .distribution-divider {
          width: 2px;
          height: 50px;
          background: linear-gradient(to bottom, transparent, #d97706, transparent);
          border-radius: 1px;
        }

        /* Card Action Button */
        .card-action {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #f1f5f9;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          transition: all 0.2s ease;
        }

        .card-action.highlight {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: white;
        }

        .glass-card:hover .card-action {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: white;
        }

        .glass-card:hover .card-action.highlight {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .action-arrow {
          font-size: 18px;
          transition: transform 0.3s ease;
        }

        .glass-card:hover .action-arrow {
          transform: translateX(4px);
        }

        /* Legacy styles for compatibility */
        .big-number {
          display: block;
          font-size: 3rem;
          font-weight: 800;
          color: #319795;
          line-height: 1;
        }

        .big-label {
          font-size: 13px;
          color: #285e61;
          margin-top: 4px;
          display: block;
        }

        .formula-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 12px;
          background: #e6fffa;
          border-radius: 10px;
        }

        .formula-item {
          text-align: center;
        }

        .formula-value {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
          color: #234e52;
        }

        .formula-label {
          font-size: 11px;
          color: #285e61;
        }

        .formula-divider {
          color: #b2f5ea;
          font-size: 1.25rem;
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .content-grid {
            grid-template-columns: 1fr;
          }
          
          .pattern-form-grid {
            grid-template-columns: 1fr;
          }
          
          .settings-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .mobile-header {
            display: flex;
          }

          .mobile-bottom-nav {
            display: flex;
          }

          .section-header-mobile {
            display: flex;
          }

          .menu-overlay {
            display: block;
          }

          .sidebar {
            transform: translateX(-100%);
            width: 280px;
          }

          .sidebar.open {
            transform: translateX(0);
          }

          .sidebar-header-mobile {
            display: flex;
          }

          .desktop-only {
            display: none !important;
          }

          .main-content {
            margin-left: 0;
            padding-top: 76px;
            padding-bottom: 140px;
          }

          /* Add padding to sections on tablet/mobile */
          #schedule.panel, #users.panel, #patterns.panel, #settings.panel {
            padding-bottom: 60px;
            margin-bottom: 40px;
          }

          .dashboard-cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .schedule-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .pattern-types {
            grid-template-columns: repeat(2, 1fr);
          }

          .top-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .header-right {
            width: 100%;
          }

          .countdown-card {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 600px) {
          .main-content {
            padding: 16px;
            padding-top: 76px;
            padding-bottom: 140px;
          }

          /* Add bottom padding to all panels/sections on mobile */
          .panel {
            margin-bottom: 24px;
          }

          #schedule, #users, #patterns, #settings {
            padding-bottom: 40px;
          }

          .dashboard-cards {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .summary-card {
            padding: 16px;
          }

          .card-stats-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
          }

          .activity-panel {
            margin-bottom: 40px;
          }

          .activity-grid {
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .activity-item {
            padding: 12px;
            flex-direction: column;
            text-align: center;
            gap: 8px;
          }

          .whatsapp-quick-actions {
            flex-direction: column;
          }

          .btn-whatsapp, .btn-whatsapp-outline {
            width: 100%;
            min-width: auto;
          }

          .mini-stat {
            padding: 8px 4px;
          }

          .mini-value {
            font-size: 1.1rem;
          }

          .mini-label {
            font-size: 9px;
          }

          .big-number {
            font-size: 2.5rem;
          }

          .modal-content {
            max-width: 100%;
            margin: 0;
            border-radius: 16px;
          }

          .profile-card {
            padding: 20px 16px;
          }

          .profile-avatar {
            width: 56px;
            height: 56px;
            font-size: 1.5rem;
          }

          .schedule-grid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .schedule-column {
            border-radius: 10px;
          }

          .column-header {
            padding: 10px;
            font-size: 11px;
            flex-wrap: wrap;
          }

          .column-icon {
            font-size: 1rem;
          }

          .column-list {
            padding: 6px;
            min-height: 80px;
          }

          .shift-item {
            padding: 6px 10px;
            font-size: 12px;
          }

          .form-grid-2 {
            grid-template-columns: 1fr;
          }

          .rule-config {
            flex-direction: column;
            align-items: stretch;
          }

          /* Schedule flow mobile styles */
          .date-selector-card {
            flex-direction: column;
            text-align: center;
            padding: 16px;
          }

          .date-selector-icon {
            font-size: 2rem;
          }

          .date-status {
            margin-top: 8px;
          }

          .schedule-status-bar {
            flex-direction: column;
            text-align: center;
            gap: 12px;
          }

          .config-section {
            padding: 16px;
          }

          /* Unified schedule mobile styles */
          .unified-limits {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .limit-card {
            padding: 14px;
          }

          .limit-icon {
            font-size: 1.5rem;
          }

          .limit-info .input {
            padding: 8px 10px;
            font-size: 16px;
          }

          .unified-available {
            flex-direction: column;
            text-align: center;
            gap: 12px;
          }

          .rule-item {
            width: 100%;
          }

          .schedule-actions {
            flex-direction: column;
          }

          .schedule-actions .input,
          .schedule-actions .btn {
            width: 100%;
          }

          .whatsapp-actions {
            flex-direction: column;
          }

          .panel {
            padding: 16px;
            border-radius: 12px;
          }

          .panel-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .panel-title {
            font-size: 1rem;
          }

          .pattern-types {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .pattern-type-btn {
            padding: 10px 6px;
            font-size: 11px;
          }

          .days-row {
            flex-wrap: wrap;
          }

          .day-btn {
            flex: 0 0 calc(25% - 6px);
            padding: 10px 4px;
            font-size: 11px;
          }

          .checkbox-grid {
            max-height: 200px;
            overflow-y: auto;
          }

          .checkbox-chip {
            padding: 8px 12px;
            font-size: 12px;
          }

          .user-row {
            flex-wrap: wrap;
            padding: 12px 10px;
            gap: 8px;
          }

          .user-info {
            flex: 1 1 60%;
            min-width: 120px;
          }

          .user-name {
            font-size: 14px;
          }

          .user-phone {
            font-size: 11px;
          }

          .role-badge {
            font-size: 9px;
            padding: 3px 8px;
          }

          .bulk-bar {
            flex-wrap: wrap;
          }

          .bulk-bar .btn {
            flex: 1;
            min-width: 100px;
          }

          .available-officers-box {
            padding: 12px;
          }

          .available-list {
            max-height: 100px;
          }

          .available-officer {
            font-size: 11px;
            padding: 3px 8px;
          }

          .day-header {
            padding: 12px;
          }

          .day-name {
            width: 80px;
            font-size: 14px;
          }

          .mini-badge {
            font-size: 10px;
            padding: 2px 6px;
          }

          .officer-tag {
            font-size: 12px;
            padding: 3px 6px 3px 8px;
          }

          .settings-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .input-group {
            width: 100%;
          }

          .input-group .input {
            flex: 1;
          }
        }

        @media (max-width: 400px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .schedule-grid {
            grid-template-columns: 1fr;
          }

          .pattern-types {
            grid-template-columns: 1fr;
          }

          .day-btn {
            flex: 0 0 calc(33.33% - 6px);
          }
        }
      `}</style>
    </div>
  );
}
