"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [morningLimit, setMorningLimit] = useState(0);
  const [afternoonLimit, setAfternoonLimit] = useState(0);
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
    if (parsed.role !== "ADMIN") {
      router.push("/");
      return;
    }
    setUser(parsed);
  }, [router]);

  const loadAll = async () => {
    const [userRes, dayRes, fullRes, lockRes, settingRes, vacationRes] = await Promise.all([
      fetch("/api/users/list").then((r) => r.json()),
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
    loadAll();
    // Initial fetch will check for last schedule if current date has no schedule
    fetchSchedule();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    
    // Load existing rule or calculate default
    fetch(`/api/rules/get?date=${ruleDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.rule) {
          setMorningLimit(data.rule.morningLimit);
          setAfternoonLimit(data.rule.afternoonLimit);
        }
      });
  }, [ruleDate]);

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
          // Fetch shifts for the last schedule date
          const lastShiftsRes = await fetch(`/api/shifts?date=${lastData.date}`);
          const lastShiftsData = await lastShiftsRes.json();
          if (lastShiftsData.ok) setShifts(lastShiftsData.shifts);
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

  const generateSchedule = async () => {
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: scheduleDate }),
    });
    const data = await res.json();
    if (data.ok) {
      setMessage("✅ Schedule generated!");
      fetchSchedule();
    } else {
      setMessage("❌ " + (data.error || "Failed"));
    }
  };

  const deleteSchedule = async () => {
    const res = await fetch("/api/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: scheduleDate }),
    });
    const data = await res.json();
    if (data.ok) {
      setMessage("🗑️ Schedule deleted.");
      setShifts([]);
    }
  };

  const saveRule = async () => {
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: ruleDate, morningLimit, afternoonLimit }),
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
    const payload = Object.fromEntries(form.entries());
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
      body: JSON.stringify(payload),
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
          body: JSON.stringify(payload),
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
      body: JSON.stringify({ id }),
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
      await navigator.clipboard.writeText(data.text);
      setMessage(mode === "dayoff" ? "📋 Day-off copied!" : "📋 Schedule copied!");
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

  return (
    <div className="admin-page">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🛫</span>
          <span className="brand-text">Immigration</span>
        </div>
        <nav className="sidebar-nav">
          <a href="#rules" className="nav-item active">
            <span>📋</span> Rules
          </a>
          <a href="#whatsapp" className="nav-item">
            <span>📣</span> WhatsApp
          </a>
          <a href="#schedule" className="nav-item">
            <span>📆</span> Schedule
          </a>
          <a href="#patterns" className="nav-item">
            <span>📅</span> Patterns
          </a>
          <a href="#register" className="nav-item">
            <span>➕</span> Register
          </a>
          <a href="#users" className="nav-item">
            <span>👥</span> Users
          </a>
          <a href="#settings" className="nav-item">
            <span>⚙️</span> Settings
          </a>
        </nav>
        <div className="sidebar-footer">
          <div className="time-display">
            <span className="time-label">Mogadishu Time</span>
            <span className="time-value">{currentTime}</span>
          </div>
          <button className="btn btn-ghost btn-block" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="top-header">
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

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card stat-purple">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <span className="stat-value">{users.length}</span>
              <span className="stat-label">Total Users</span>
            </div>
          </div>
          <div className="stat-card stat-green">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <span className="stat-value">{officerUsers.filter((u) => u.isActive).length}</span>
              <span className="stat-label">Active Officers</span>
            </div>
          </div>
          <div className="stat-card stat-blue">
            <div className="stat-icon">📋</div>
            <div className="stat-info">
              <span className="stat-value">{totalPatterns}</span>
              <span className="stat-label">Weekly Rules</span>
            </div>
          </div>
          <div className="stat-card stat-orange">
            <div className="stat-icon">🏖️</div>
            <div className="stat-info">
              <span className="stat-value">{vacations.filter((v) => v.status === "APPROVED").length}</span>
              <span className="stat-label">Vacations</span>
            </div>
          </div>
        </div>

        {/* 1. Rules by Day - Collapsible */}
        <section id="rules" className="panel panel-wide">
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

        {/* 2. WhatsApp Export */}
        <section id="whatsapp" className="panel panel-wide">
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="title-icon">📣</span> WhatsApp Export
            </h2>
          </div>
          <div className="whatsapp-actions">
            <button className="btn btn-success btn-lg" onClick={() => copyWhatsApp("full")}>
              📋 Copy Full Schedule
            </button>
            <button className="btn btn-lg" onClick={() => copyWhatsApp("dayoff")}>
              🏠 Copy Day-Off Only
            </button>
          </div>
          {whatsText && <pre className="whatsapp-box">{whatsText}</pre>}
        </section>

        {/* 3. Daily Schedule */}
        <section id="schedule" className="panel panel-wide">
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="title-icon">📆</span> Daily Schedule
              <span className="schedule-label">{getScheduleViewLabel()}</span>
            </h2>
            <p className="muted">Date: {scheduleDate}</p>
          </div>
          <div className="schedule-controls">
            <div className="rule-config">
              <div className="rule-item">
                <label>Date</label>
                <input type="date" className="input" value={ruleDate} onChange={(e) => setRuleDate(e.target.value)} />
              </div>
              <div className="rule-item">
                <label>Morning ({Math.ceil((availableCount * 3) / 5)} suggested)</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  value={morningLimit}
                  onChange={(e) => setMorningLimit(Number(e.target.value))}
                />
              </div>
              <div className="rule-item">
                <label>Afternoon ({Math.floor((availableCount * 2) / 5)} suggested)</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  value={afternoonLimit}
                  onChange={(e) => setAfternoonLimit(Number(e.target.value))}
                />
              </div>
              <button className="btn btn-primary" onClick={saveRule}>
                Save Rule
              </button>
            </div>
            
            {/* Available Officers Info */}
            <div className="available-officers-box">
              <div className="available-header">
                <span className="available-icon">👤</span>
                <span className="available-label">Available Officers for {ruleDate}</span>
                <span className="available-count">{availableCount}</span>
              </div>
              <div className="available-list">
                {availableOfficers.map((o) => (
                  <span key={o.id} className="available-officer">{o.fullName}</span>
                ))}
                {availableOfficers.length === 0 && <span className="muted">No available officers</span>}
              </div>
              <div className="available-formula">
                3/5 Morning = {Math.ceil((availableCount * 3) / 5)} | 2/5 Afternoon = {Math.floor((availableCount * 2) / 5)}
              </div>
            </div>

            <div className="schedule-actions">
              <input type="date" className="input" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
              <button className="btn" onClick={() => fetchSchedule()}>
                Load
              </button>
              <button className="btn btn-primary" onClick={generateSchedule}>
                Generate
              </button>
              <button className="btn btn-danger" onClick={deleteSchedule}>
                Delete
              </button>
            </div>
          </div>
          <div className="schedule-grid">
            {["MORNING", "AFTERNOON", "FULLTIME", "DAYOFF", "VACATION"].map((shiftType) => {
              const shiftList = shifts.filter((s) => s.type === shiftType);
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
                    {shiftList.length === 0 && <div className="empty-text">No officers</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Weekly Patterns Form */}
        <section id="patterns" className="panel panel-wide panel-accent">
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
        <div className="content-grid">
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
        <section id="settings" className="panel panel-wide">
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
      </main>

      <style jsx>{`
        .admin-page {
          display: flex;
          min-height: 100vh;
          background: linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%);
        }

        /* Sidebar */
        .sidebar {
          width: 220px;
          background: linear-gradient(180deg, #1a365d 0%, #2c5282 100%);
          color: white;
          display: flex;
          flex-direction: column;
          position: fixed;
          height: 100vh;
          z-index: 100;
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
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          margin-bottom: 4px;
          transition: all 0.2s;
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
        }

        .time-label {
          display: block;
          font-size: 10px;
          opacity: 0.7;
          text-transform: uppercase;
        }

        .time-value {
          font-size: 1.25rem;
          font-weight: 700;
        }

        /* Main Content */
        .main-content {
          flex: 1;
          margin-left: 220px;
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

        /* Schedule Section */
        .schedule-controls {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 20px;
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
          .sidebar {
            display: none;
          }

          .main-content {
            margin-left: 0;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .schedule-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .pattern-types {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .main-content {
            padding: 12px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .schedule-grid {
            grid-template-columns: 1fr;
          }

          .form-grid-2 {
            grid-template-columns: 1fr;
          }

          .rule-config {
            flex-direction: column;
            align-items: stretch;
          }

          .rule-item {
            width: 100%;
          }

          .schedule-actions {
            flex-direction: column;
          }

          .whatsapp-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
