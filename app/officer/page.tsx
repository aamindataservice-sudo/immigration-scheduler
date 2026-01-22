"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMogadishuTomorrowISO } from "@/lib/time";

type Shift = { id: string; date: string; type: string };

function getMogadishuTimeString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Mogadishu", hour: "2-digit", minute: "2-digit", hour12: true,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

export default function OfficerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [assigned, setAssigned] = useState<Shift | null>(null);
  const [message, setMessage] = useState("");
  const [tomorrow] = useState(getMogadishuTomorrowISO());
  const [canChoose, setCanChoose] = useState(true);
  const [choiceReason, setChoiceReason] = useState<string | null>(null);
  const [morningLimit, setMorningLimit] = useState(0);
  const [afternoonLimit, setAfternoonLimit] = useState(0);
  const [currentTime, setCurrentTime] = useState("--:-- --");
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("currentUser");
    if (!raw) { router.push("/"); return; }
    const parsed = JSON.parse(raw);
    if (parsed.mustChangePassword) { router.push("/change-password"); return; }
    if (parsed.role !== "OFFICER") { router.push("/"); return; }
    setUser(parsed);
  }, [router]);

  const loadAll = async (userId: string) => {
    const [historyRes, statusRes, assignedRes, ruleRes] = await Promise.all([
      fetch(`/api/shifts/my-shifts?userId=${userId}`).then(r => r.json()),
      fetch(`/api/shifts/status?date=${tomorrow}`).then(r => r.json()),
      fetch(`/api/shifts/my-day?userId=${userId}&date=${tomorrow}`).then(r => r.json()),
      fetch(`/api/rules/get?date=${tomorrow}`).then(r => r.json()),
    ]);
    if (historyRes.ok) setHistory(historyRes.shifts);
    if (statusRes.ok) { setCanChoose(statusRes.choicesOpen); setChoiceReason(statusRes.reason ?? null); }
    if (assignedRes.ok) setAssigned(assignedRes.shift);
    if (ruleRes.ok && ruleRes.rule) { setMorningLimit(ruleRes.rule.morningLimit); setAfternoonLimit(ruleRes.rule.afternoonLimit); }
  };

  useEffect(() => { if (user?.id) loadAll(user.id); }, [user, tomorrow]);
  useEffect(() => {
    const tick = () => setCurrentTime(getMogadishuTimeString());
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  const shiftStats = useMemo(() => {
    const morning = history.filter(s => s.type === "MORNING").length;
    const afternoon = history.filter(s => s.type === "AFTERNOON").length;
    const fulltime = history.filter(s => s.type === "FULLTIME").length;
    const dayoff = history.filter(s => s.type === "DAYOFF" || s.type === "VACATION").length;
    return { morning, afternoon, fulltime, dayoff, total: history.length };
  }, [history]);

  const choose = async (choice: "MORNING" | "AFTERNOON") => {
    setMessage("");
    const res = await fetch("/api/shifts/choose", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, date: tomorrow, choice }),
    });
    const data = await res.json();
    setMessage(data.ok ? "✅ Choice saved!" : "❌ " + (data.error || "Failed"));
    if (data.ok) loadAll(user.id);
  };

  const logout = () => { localStorage.removeItem("currentUser"); router.push("/"); };

  return (
    <div className="officer-page">
      {/* Header */}
      <header className="page-header">
        <div className="header-left">
          <div className="user-avatar">{user?.fullName?.charAt(0)?.toUpperCase() || "?"}</div>
          <div className="user-info">
            <h1>{user?.fullName}</h1>
            <span className="time-badge">{currentTime}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => setShowProfile(true)}>👤</button>
          <button className="btn-icon logout" onClick={logout}>🚪</button>
        </div>
      </header>

      {message && <div className="toast" onClick={() => setMessage("")}>{message}</div>}

      {/* Profile Modal */}
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👤 My Profile</h2>
              <button className="close-btn" onClick={() => setShowProfile(false)}>✕</button>
            </div>
            <div className="profile-card">
              <div className="profile-avatar">{user?.fullName?.charAt(0)?.toUpperCase() || "?"}</div>
              <div className="profile-info">
                <h3>{user?.fullName}</h3>
                <span className="role-badge">OFFICER</span>
              </div>
            </div>
            <div className="profile-details">
              <div className="detail-row"><span>📱 Phone</span><span>{user?.phone}</span></div>
              <div className="detail-row"><span>🔐 Status</span><span className="status-active">Active</span></div>
              <div className="detail-row"><span>📊 Total Shifts</span><span>{shiftStats.total}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {/* Tomorrow's Shift - Hero Card */}
        <section className="hero-card">
          <div className="hero-label">📅 Tomorrow&apos;s Schedule • {tomorrow}</div>
          
          {assigned ? (
            <div className={`shift-display ${assigned.type.toLowerCase()}`}>
              <span className="shift-emoji">
                {assigned.type === "MORNING" ? "🌅" : assigned.type === "AFTERNOON" ? "🌇" : assigned.type === "FULLTIME" ? "⏰" : "🏠"}
              </span>
              <span className="shift-text">{assigned.type}</span>
              <span className="shift-hint">Your assigned shift</span>
            </div>
          ) : canChoose ? (
            <div className="choice-section">
              <p className="choice-prompt">Choose your preferred shift:</p>
              <div className="shift-buttons">
                <button className="shift-btn morning" onClick={() => choose("MORNING")}>
                  <span className="btn-emoji">🌅</span>
                  <span className="btn-label">Morning</span>
                  <span className="btn-slots">{morningLimit} slots</span>
                </button>
                <button className="shift-btn afternoon" onClick={() => choose("AFTERNOON")}>
                  <span className="btn-emoji">🌇</span>
                  <span className="btn-label">Afternoon</span>
                  <span className="btn-slots">{afternoonLimit} slots</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="waiting-box">
              <span className="waiting-emoji">⏳</span>
              <span className="waiting-text">Choices Closed</span>
              <span className="waiting-hint">{choiceReason === "cutoff-passed" ? "Deadline passed. Await schedule." : "Schedule is being generated."}</span>
            </div>
          )}
        </section>

        {/* Stats Cards */}
        <section className="stats-section">
          <h2 className="section-title">📊 My Shift Stats</h2>
          <div className="stats-grid">
            <div className="stat-card morning">
              <span className="stat-emoji">🌅</span>
              <span className="stat-value">{shiftStats.morning}</span>
              <span className="stat-label">Morning</span>
            </div>
            <div className="stat-card afternoon">
              <span className="stat-emoji">🌇</span>
              <span className="stat-value">{shiftStats.afternoon}</span>
              <span className="stat-label">Afternoon</span>
            </div>
            <div className="stat-card fulltime">
              <span className="stat-emoji">⏰</span>
              <span className="stat-value">{shiftStats.fulltime}</span>
              <span className="stat-label">Full-Time</span>
            </div>
            <div className="stat-card dayoff">
              <span className="stat-emoji">🏠</span>
              <span className="stat-value">{shiftStats.dayoff}</span>
              <span className="stat-label">Days Off</span>
            </div>
          </div>
        </section>

        {/* Recent History */}
        <section className="history-section">
          <h2 className="section-title">📋 Recent Shifts</h2>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="empty-state">
                <span>📭</span>
                <span>No shifts recorded yet</span>
              </div>
            ) : (
              history.slice(0, 10).map((s) => (
                <div key={s.id} className="history-item">
                  <span className="history-date">{String(s.date).slice(0, 10)}</span>
                  <span className={`history-badge ${s.type.toLowerCase()}`}>
                    {s.type === "MORNING" ? "🌅" : s.type === "AFTERNOON" ? "🌇" : s.type === "FULLTIME" ? "⏰" : "🏠"} {s.type}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <style jsx>{`
        .officer-page { min-height: 100vh; background: linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%); }
        .page-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(255,255,255,0.05); }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .user-avatar { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.25rem; }
        .user-info h1 { color: white; font-size: 1.1rem; margin: 0 0 4px; }
        .time-badge { background: rgba(255,255,255,0.1); color: #94a3b8; padding: 4px 10px; border-radius: 20px; font-size: 12px; }
        .header-actions { display: flex; gap: 8px; }
        .btn-icon { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.1); border: none; font-size: 1.25rem; cursor: pointer; transition: all 0.2s; }
        .btn-icon:hover { background: rgba(255,255,255,0.2); }
        .btn-icon.logout { background: rgba(239, 68, 68, 0.2); }
        .btn-icon.logout:hover { background: rgba(239, 68, 68, 0.3); }
        
        .main-content { padding: 20px; padding-bottom: 140px; }
        
        .toast { position: fixed; top: 80px; left: 50%; transform: translateX(-50%); padding: 14px 24px; background: #1a365d; color: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 100; cursor: pointer; }
        
        /* Hero Card */
        .hero-card { background: white; border-radius: 20px; padding: 24px; margin-bottom: 20px; text-align: center; }
        .hero-label { font-size: 14px; color: #64748b; margin-bottom: 20px; }
        
        .shift-display { padding: 32px 24px; border-radius: 16px; }
        .shift-display.morning { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); }
        .shift-display.afternoon { background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%); }
        .shift-display.fulltime { background: linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%); }
        .shift-display.dayoff, .shift-display.vacation { background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e0 100%); }
        .shift-emoji { display: block; font-size: 3rem; margin-bottom: 8px; }
        .shift-text { display: block; font-size: 1.75rem; font-weight: 700; color: #1e293b; }
        .shift-hint { display: block; font-size: 13px; color: #64748b; margin-top: 4px; }
        
        .choice-section {}
        .choice-prompt { color: #475569; margin-bottom: 16px; }
        .shift-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .shift-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 16px; border-radius: 16px; border: 2px solid; cursor: pointer; transition: all 0.2s; }
        .shift-btn.morning { background: #fffbeb; border-color: #fbbf24; }
        .shift-btn.morning:hover { background: #fef3c7; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(251, 191, 36, 0.3); }
        .shift-btn.afternoon { background: #eff6ff; border-color: #3b82f6; }
        .shift-btn.afternoon:hover { background: #dbeafe; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3); }
        .btn-emoji { font-size: 2.5rem; }
        .btn-label { font-size: 1.1rem; font-weight: 600; color: #1e293b; }
        .btn-slots { font-size: 12px; color: #64748b; }
        
        .waiting-box { padding: 32px 24px; background: #fefce8; border-radius: 16px; }
        .waiting-emoji { display: block; font-size: 2.5rem; margin-bottom: 8px; }
        .waiting-text { display: block; font-size: 1.25rem; font-weight: 600; color: #854d0e; }
        .waiting-hint { display: block; font-size: 13px; color: #a16207; margin-top: 4px; }
        
        /* Stats */
        .stats-section { margin-bottom: 20px; }
        .section-title { color: white; font-size: 1rem; margin-bottom: 12px; opacity: 0.9; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .stat-card { background: rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; text-align: center; backdrop-filter: blur(10px); }
        .stat-card.morning { border-left: 3px solid #fbbf24; }
        .stat-card.afternoon { border-left: 3px solid #3b82f6; }
        .stat-card.fulltime { border-left: 3px solid #8b5cf6; }
        .stat-card.dayoff { border-left: 3px solid #6b7280; }
        .stat-emoji { display: block; font-size: 1.5rem; margin-bottom: 4px; }
        .stat-value { display: block; font-size: 1.5rem; font-weight: 700; color: white; }
        .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; }
        
        /* History */
        .history-section { background: rgba(255,255,255,0.05); border-radius: 20px; padding: 20px; }
        .history-list { display: flex; flex-direction: column; gap: 8px; }
        .history-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.05); border-radius: 12px; }
        .history-date { color: #94a3b8; font-size: 14px; }
        .history-badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .history-badge.morning { background: #fef3c7; color: #92400e; }
        .history-badge.afternoon { background: #dbeafe; color: #1e40af; }
        .history-badge.fulltime { background: #ede9fe; color: #5b21b6; }
        .history-badge.dayoff, .history-badge.vacation { background: #f1f5f9; color: #475569; }
        .empty-state { text-align: center; padding: 32px; color: #64748b; display: flex; flex-direction: column; gap: 8px; }
        .empty-state span:first-child { font-size: 2rem; }
        
        /* Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
        .modal-content { background: white; border-radius: 20px; width: 100%; max-width: 380px; overflow: hidden; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; }
        .modal-header h2 { font-size: 1.1rem; margin: 0; }
        .close-btn { width: 32px; height: 32px; border-radius: 8px; background: #f1f5f9; border: none; cursor: pointer; }
        .profile-card { display: flex; align-items: center; gap: 16px; padding: 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .profile-avatar { width: 56px; height: 56px; border-radius: 14px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; }
        .profile-info h3 { margin: 0 0 6px; font-size: 1.1rem; }
        .role-badge { background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 12px; font-size: 11px; }
        .profile-details { padding: 16px 20px; }
        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .status-active { color: #16a34a; font-weight: 600; }
        
        @media (max-width: 600px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .shift-buttons { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
