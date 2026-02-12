"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMogadishuTomorrowISO } from "@/lib/time";
import OfficerScanView from "@/components/OfficerScanView";

export const dynamic = "force-dynamic";

type Shift = { id: string; date: string; type: string };
type OfficerTabId = "check-visa" | "check-payment" | "scan-me" | "my-shifts";

function getMogadishuTimeString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Mogadishu", hour: "2-digit", minute: "2-digit", hour12: true,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

const VISA_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const VISA_YEARS = ["2025", "2026", "2027"];

export default function OfficerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [privilege, setPrivilege] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<OfficerTabId>("my-shifts");

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
  const [loading, setLoading] = useState(false);

  // Check Visa form
  const [passportNumber, setPassportNumber] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [visaYear, setVisaYear] = useState("2026");
  const [visaMonth, setVisaMonth] = useState("Jan");

  // Check Payment form
  const [serialNumber, setSerialNumber] = useState("");

  const tabs = useMemo(() => {
    const list: { id: OfficerTabId; label: string; icon: string }[] = [];
    if (privilege?.canCheckEVisa) list.push({ id: "check-visa", label: "Check Visa", icon: "📄" });
    if (privilege?.canCheckPayment) list.push({ id: "check-payment", label: "Payment", icon: "💳" });
    if (user?.role === "OFFICER" && privilege?.canScanMe !== false) list.push({ id: "scan-me", label: "Scan Me", icon: "📷" });
    list.push({ id: "my-shifts", label: "My Shifts", icon: "📅" });
    return list;
  }, [privilege, user?.role]);

  const defaultTab = useMemo((): OfficerTabId => {
    if (privilege?.canCheckEVisa) return "check-visa";
    if (privilege?.canCheckPayment) return "check-payment";
    if (user?.role === "OFFICER" && privilege?.canScanMe !== false) return "scan-me";
    return "my-shifts";
  }, [privilege, user?.role]);

  useEffect(() => {
    const raw = localStorage.getItem("currentUser");
    if (!raw) { router.push("/"); return; }
    const parsed = JSON.parse(raw);
    if (parsed.mustChangePassword) { router.push("/change-password"); return; }
    if (parsed.role !== "OFFICER") { router.push("/"); return; }
    setUser(parsed);
  }, [router]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/auth/my-privileges?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.privilege) setPrivilege(data.privilege);
        else setPrivilege({});
      });
  }, [user?.id]);

  const hasSetInitialTab = useRef(false);
  useEffect(() => {
    if (!privilege || hasSetInitialTab.current) return;
    hasSetInitialTab.current = true;
    setActiveTab(defaultTab);
  }, [privilege, defaultTab]);

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

  const checkEvisa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); setLoading(true);
    try {
      const res = await fetch("/api/payment/check-evisa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passportNumber: passportNumber.trim(),
          referenceNumber: referenceNumber.trim(),
          visaYear, visaMonth, checkedBy: user.id,
        }),
      });
      const data = await res.json();
      if (data.ok && data.check?.status === "FOUND" && data.check?.visaUrl) {
        window.open(data.check.visaUrl, "_blank");
        setMessage("✅ " + (data.check.message || "Visa found"));
      } else {
        setMessage("❌ " + (data.check?.message || data.error || "Not found"));
      }
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Error"));
    } finally {
      setLoading(false);
    }
  };

  const checkPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); setLoading(true);
    try {
      const res = await fetch("/api/payment/download-receipt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber, checkedBy: user.id }),
      });
      const data = await res.json();
      if (data.ok && data.check?.localPath) {
        window.open(data.check.localPath, "_blank");
        setMessage("✅ Receipt opened"); setSerialNumber("");
      } else {
        setMessage("❌ " + (data.check?.message || data.error || "Not found"));
      }
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Error"));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => { localStorage.removeItem("currentUser"); router.push("/"); };

  if (!user) {
    return (
      <div className="officer-page officer-loading">
        <div className="officer-loading-bg" />
        <div className="officer-loading-card">
          <div className="loading-spinner" />
          <span className="officer-loading-text">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="officer-page">
      <div className="officer-bg" aria-hidden />

      <header className="officer-header">
        <div className="officer-header-left">
          <div className="officer-avatar">
            <span className="officer-avatar-inner">{user?.fullName?.charAt(0)?.toUpperCase() || "?"}</span>
          </div>
          <div className="officer-header-info">
            <h1 className="officer-title">{user?.fullName}</h1>
            <span className="officer-time">{currentTime}</span>
          </div>
        </div>
        <div className="officer-header-actions">
          <button type="button" className="officer-btn-icon" onClick={() => setShowProfile(true)} aria-label="Profile">👤</button>
          <button type="button" className="officer-btn-icon officer-btn-logout" onClick={logout} aria-label="Logout">🚪</button>
        </div>
      </header>

      {message && (
        <div className="officer-toast" role="alert" onClick={() => setMessage("")}>
          {message}
        </div>
      )}

      {tabs.length > 1 && (
        <nav className="officer-tabs" aria-label="Dashboard sections">
          <div className="officer-tabs-inner">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`officer-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="officer-tab-icon">{tab.icon}</span>
                <span className="officer-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="officer-main">
        {activeTab === "check-visa" && (
          <section className="officer-card officer-section officer-anim-in">
            <h2 className="officer-card-title">📄 Check Visa</h2>
            <p className="officer-card-sub">Verify e-Visa status and download PDF</p>
            <form onSubmit={checkEvisa} className="officer-form">
              <div className="officer-field">
                <label className="officer-label">Passport number</label>
                <input
                  type="text"
                  className="officer-input"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. NXBRJ51J6"
                  required
                />
              </div>
              <div className="officer-field">
                <label className="officer-label">Reference number</label>
                <input
                  type="text"
                  className="officer-input"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. 1764136564"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                />
              </div>
              <div className="officer-row">
                <div className="officer-field">
                  <label className="officer-label">Month</label>
                  <select className="officer-input" value={visaMonth} onChange={(e) => setVisaMonth(e.target.value)}>
                    {VISA_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="officer-field">
                  <label className="officer-label">Year</label>
                  <select className="officer-input" value={visaYear} onChange={(e) => setVisaYear(e.target.value)}>
                    {VISA_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="officer-btn-primary" disabled={loading}>
                {loading ? "Checking…" : "🔍 Check Visa"}
              </button>
            </form>
          </section>
        )}

        {activeTab === "check-payment" && (
          <section className="officer-card officer-section officer-anim-in">
            <h2 className="officer-card-title">💳 Check Payment</h2>
            <p className="officer-card-sub">Enter serial number to verify receipt</p>
            <form onSubmit={checkPayment} className="officer-form">
              <div className="officer-field">
                <label className="officer-label">Serial number</label>
                <input
                  type="text"
                  className="officer-input"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g. 1763816489"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                />
              </div>
              <button type="submit" className="officer-btn-primary" disabled={loading}>
                {loading ? "Checking…" : "🔍 Check Payment"}
              </button>
            </form>
          </section>
        )}

        {activeTab === "scan-me" && (
          <section className="officer-scan-section officer-anim-in">
            <div className="officer-scan-section-header">
              <h2 className="officer-scan-section-title">📷 Scan Me</h2>
              <p className="officer-scan-section-sub">Etas QR scanner — verify e-Visa at the counter</p>
            </div>
            <OfficerScanView />
          </section>
        )}

        {activeTab === "my-shifts" && (
          <>
            <section className="officer-card officer-hero officer-anim-in">
              <div className="officer-hero-label">📅 Tomorrow • {tomorrow}</div>
              {assigned ? (
                <div className={`officer-shift-badge ${assigned.type.toLowerCase()}`}>
                  <span className="officer-shift-emoji">
                    {assigned.type === "MORNING" ? "🌅" : assigned.type === "AFTERNOON" ? "🌇" : assigned.type === "FULLTIME" ? "⏰" : "🏠"}
                  </span>
                  <span className="officer-shift-text">{assigned.type}</span>
                  <span className="officer-shift-hint">Your assigned shift</span>
                </div>
              ) : canChoose ? (
                <div className="officer-choose">
                  <p className="officer-choose-prompt">Choose your preferred shift:</p>
                  <div className="officer-shift-buttons">
                    <button type="button" className="officer-shift-btn morning" onClick={() => choose("MORNING")}>
                      <span className="officer-shift-btn-emoji">🌅</span>
                      <span className="officer-shift-btn-label">Morning</span>
                      <span className="officer-shift-btn-slots">{morningLimit} slots</span>
                    </button>
                    <button type="button" className="officer-shift-btn afternoon" onClick={() => choose("AFTERNOON")}>
                      <span className="officer-shift-btn-emoji">🌇</span>
                      <span className="officer-shift-btn-label">Afternoon</span>
                      <span className="officer-shift-btn-slots">{afternoonLimit} slots</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="officer-waiting">
                  <span className="officer-waiting-emoji">⏳</span>
                  <span className="officer-waiting-text">Choices closed</span>
                  <span className="officer-waiting-hint">{choiceReason === "cutoff-passed" ? "Deadline passed. Await schedule." : "Schedule is being generated."}</span>
                </div>
              )}
            </section>

            <section className="officer-card officer-stats officer-anim-in officer-anim-delay-1">
              <h2 className="officer-stats-title">📊 My shift stats</h2>
              <div className="officer-stats-grid">
                <div className="officer-stat morning"><span className="officer-stat-emoji">🌅</span><span className="officer-stat-value">{shiftStats.morning}</span><span className="officer-stat-label">Morning</span></div>
                <div className="officer-stat afternoon"><span className="officer-stat-emoji">🌇</span><span className="officer-stat-value">{shiftStats.afternoon}</span><span className="officer-stat-label">Afternoon</span></div>
                <div className="officer-stat fulltime"><span className="officer-stat-emoji">⏰</span><span className="officer-stat-value">{shiftStats.fulltime}</span><span className="officer-stat-label">Full-time</span></div>
                <div className="officer-stat dayoff"><span className="officer-stat-emoji">🏠</span><span className="officer-stat-value">{shiftStats.dayoff}</span><span className="officer-stat-label">Days off</span></div>
              </div>
            </section>

            <section className="officer-card officer-history officer-anim-in officer-anim-delay-2">
              <h2 className="officer-history-title">📋 Recent shifts</h2>
              <div className="officer-history-list">
                {history.length === 0 ? (
                  <div className="officer-history-empty">No shifts recorded yet</div>
                ) : (
                  history.slice(0, 10).map((s) => (
                    <div key={s.id} className="officer-history-item">
                      <span className="officer-history-date">{String(s.date).slice(0, 10)}</span>
                      <span className={`officer-history-badge ${s.type.toLowerCase()}`}>
                        {s.type === "MORNING" ? "🌅" : s.type === "AFTERNOON" ? "🌇" : s.type === "FULLTIME" ? "⏰" : "🏠"} {s.type}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {showProfile && (
          <div className="officer-modal-overlay officer-modal-overlay-in" onClick={() => setShowProfile(false)}>
            <div className="officer-modal officer-modal-in" onClick={(e) => e.stopPropagation()}>
              <div className="officer-modal-header">
                <h2>👤 My profile</h2>
                <button type="button" className="officer-modal-close" onClick={() => setShowProfile(false)} aria-label="Close">✕</button>
              </div>
              <div className="officer-profile-card">
                <div className="officer-profile-avatar">{user?.fullName?.charAt(0)?.toUpperCase() || "?"}</div>
                <div className="officer-profile-info">
                  <h3>{user?.fullName}</h3>
                  <span className="officer-role-badge">OFFICER</span>
                </div>
              </div>
              <div className="officer-profile-details">
                <div className="officer-detail-row"><span>📱 Phone</span><span>{user?.phone}</span></div>
                <div className="officer-detail-row"><span>🔐 Status</span><span className="officer-status-active">Active</span></div>
                <div className="officer-detail-row"><span>📊 Total shifts</span><span>{shiftStats.total}</span></div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes officer-spin { to { transform: rotate(360deg); } }
        @keyframes officer-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes officer-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes officer-scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes officer-slideDown { from { opacity: 0; transform: translate(-50%, -12px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes officer-bgShift { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
        @keyframes officer-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes officer-glow { 0%, 100% { box-shadow: 0 0 20px rgba(56, 189, 248, 0.15); } 50% { box-shadow: 0 0 28px rgba(56, 189, 248, 0.25); } }

        .officer-page { position: relative; min-height: 100vh; color: #e2e8f0; overflow-x: hidden; }
        .officer-bg { position: fixed; inset: 0; background: linear-gradient(165deg, #0f172a 0%, #1e3a5f 40%, #0c4a6e 70%, #0f172a 100%); background-size: 200% 200%; animation: officer-bgShift 12s ease-in-out infinite; z-index: 0; }
        .officer-loading { position: relative; display: flex; align-items: center; justify-content: center; min-height: 100vh; z-index: 1; }
        .officer-loading-bg { position: absolute; inset: 0; background: linear-gradient(165deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%); }
        .officer-loading-card { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 32px 48px; background: rgba(255,255,255,0.06); border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); animation: officer-scaleIn 0.4s ease-out; }
        .loading-spinner { width: 44px; height: 44px; border: 3px solid rgba(255,255,255,0.12); border-top-color: #38bdf8; border-radius: 50%; animation: officer-spin 0.7s linear infinite; }
        .officer-loading-text { font-size: 15px; color: #94a3b8; font-weight: 500; }

        .officer-header { position: relative; z-index: 10; display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; background: rgba(15,23,42,0.82); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.08); }
        .officer-header-left { display: flex; align-items: center; gap: 16px; }
        .officer-avatar { width: 56px; height: 56px; border-radius: 18px; background: linear-gradient(145deg, #0ea5e9 0%, #6366f1 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 24px rgba(14, 165, 233, 0.4); transition: transform 0.2s, box-shadow 0.2s; }
        .officer-avatar:hover { transform: scale(1.04); box-shadow: 0 8px 28px rgba(14, 165, 233, 0.5); }
        .officer-avatar-inner { font-weight: 700; font-size: 1.4rem; color: white; }
        .officer-header-info { display: flex; flex-direction: column; gap: 6px; }
        .officer-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: white; letter-spacing: -0.03em; }
        .officer-time { font-size: 13px; color: #94a3b8; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
        .officer-header-actions { display: flex; gap: 12px; }
        .officer-btn-icon { width: 48px; height: 48px; border-radius: 16px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.06); font-size: 1.3rem; cursor: pointer; transition: all 0.25s ease; }
        .officer-btn-icon:hover { background: rgba(255,255,255,0.14); transform: scale(1.06); }
        .officer-btn-icon:active { transform: scale(0.98); }
        .officer-btn-logout { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.2); }
        .officer-btn-logout:hover { background: rgba(239,68,68,0.25); }

        .officer-toast { position: fixed; top: 92px; left: 50%; transform: translateX(-50%); padding: 18px 32px; background: rgba(30, 41, 59, 0.96); backdrop-filter: blur(14px); color: white; border-radius: 18px; box-shadow: 0 16px 48px rgba(0,0,0,0.4); z-index: 100; cursor: pointer; font-size: 15px; max-width: 90vw; border: 1px solid rgba(255,255,255,0.1); animation: officer-slideDown 0.35s ease-out; }

        .officer-tabs { position: relative; z-index: 5; padding: 16px 20px; background: rgba(15,23,42,0.45); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.07); overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .officer-tabs-inner { display: flex; gap: 10px; min-width: min-content; }
        .officer-tab { display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-radius: 16px; border: 1px solid transparent; background: rgba(255,255,255,0.06); color: #94a3b8; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); white-space: nowrap; }
        .officer-tab:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; transform: translateY(-2px); }
        .officer-tab.active { background: linear-gradient(135deg, rgba(56,189,248,0.2), rgba(99,102,241,0.12)); color: #7dd3fc; border-color: rgba(56,189,248,0.35); box-shadow: 0 4px 20px rgba(56,189,248,0.15); }
        .officer-tab.active:hover { background: linear-gradient(135deg, rgba(56,189,248,0.26), rgba(99,102,241,0.16)); box-shadow: 0 6px 24px rgba(56,189,248,0.2); }
        .officer-tab-icon { font-size: 1.2rem; transition: transform 0.25s; }
        .officer-tab.active .officer-tab-icon { transform: scale(1.12); }

        .officer-main { position: relative; z-index: 1; padding: 26px 20px 140px; max-width: 560px; margin: 0 auto; }
        .officer-anim-in { animation: officer-fadeUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .officer-anim-delay-1 { animation-delay: 0.08s; opacity: 0; }
        .officer-anim-delay-2 { animation-delay: 0.16s; opacity: 0; }
        .officer-card { background: rgba(255,255,255,0.06); backdrop-filter: blur(14px); border-radius: 24px; padding: 28px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.08); transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .officer-card:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(0,0,0,0.22); }
        .officer-card-title { margin: 0 0 8px; font-size: 1.3rem; font-weight: 700; color: white; letter-spacing: -0.03em; }
        .officer-card-sub { margin: 0 0 24px; font-size: 14px; color: #94a3b8; line-height: 1.5; }
        .officer-form { display: flex; flex-direction: column; gap: 22px; }
        .officer-field { display: flex; flex-direction: column; gap: 10px; }
        .officer-label { font-size: 14px; font-weight: 600; color: #cbd5e1; }
        .officer-input { padding: 18px 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(15,23,42,0.55); color: white; font-size: 16px; transition: border-color 0.2s, box-shadow 0.2s; }
        .officer-input:focus { outline: none; border-color: rgba(56,189,248,0.55); box-shadow: 0 0 0 3px rgba(56,189,248,0.18); }
        .officer-input::placeholder { color: #64748b; }
        .officer-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .officer-btn-primary { padding: 20px 30px; border-radius: 18px; border: none; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; font-size: 17px; font-weight: 700; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 6px 24px rgba(14, 165, 233, 0.35); }
        .officer-btn-primary:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(14, 165, 233, 0.45); }
        .officer-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .officer-btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        .officer-scan-section { margin-bottom: 24px; background: rgba(255,255,255,0.05); backdrop-filter: blur(12px); border-radius: 22px; border: 1px solid rgba(255,255,255,0.08); }
        .officer-scan-section-header { padding: 22px 24px 8px; }
        .officer-scan-section-title { margin: 0 0 6px; font-size: 1.28rem; font-weight: 700; color: white; letter-spacing: -0.02em; }
        .officer-scan-section-sub { margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.45; }
        .officer-scan-loading { padding: 40px; text-align: center; color: #94a3b8; }

        .officer-hero { text-align: center; }
        .officer-hero-label { font-size: 14px; color: #94a3b8; margin-bottom: 24px; letter-spacing: 0.03em; }
        .officer-shift-badge { padding: 36px 30px; border-radius: 24px; transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .officer-shift-badge:hover { transform: scale(1.02); }
        .officer-shift-badge.morning { background: linear-gradient(135deg, rgba(251,191,36,0.24), rgba(245,158,11,0.14)); border: 1px solid rgba(251,191,36,0.4); box-shadow: 0 12px 32px rgba(251, 191, 36, 0.12); }
        .officer-shift-badge.afternoon { background: linear-gradient(135deg, rgba(59,130,246,0.24), rgba(37,99,235,0.14)); border: 1px solid rgba(59,130,246,0.4); box-shadow: 0 12px 32px rgba(59, 130, 246, 0.12); }
        .officer-shift-badge.fulltime { background: linear-gradient(135deg, rgba(139,92,246,0.24), rgba(124,58,237,0.14)); border: 1px solid rgba(139,92,246,0.4); box-shadow: 0 12px 32px rgba(139, 92, 246, 0.12); }
        .officer-shift-badge.dayoff, .officer-shift-badge.vacation { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); }
        .officer-shift-emoji { display: block; font-size: 3rem; margin-bottom: 12px; }
        .officer-shift-text { display: block; font-size: 1.7rem; font-weight: 700; color: white; letter-spacing: -0.03em; }
        .officer-shift-hint { display: block; font-size: 14px; color: #94a3b8; margin-top: 8px; }
        .officer-choose-prompt { color: #94a3b8; margin-bottom: 20px; font-size: 15px; }
        .officer-shift-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .officer-shift-btn { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 28px 20px; border-radius: 22px; border: 2px solid; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: transparent; color: inherit; }
        .officer-shift-btn.morning { border-color: rgba(251,191,36,0.55); color: #fcd34d; }
        .officer-shift-btn.morning:hover { background: rgba(251,191,36,0.16); transform: translateY(-4px); box-shadow: 0 14px 32px rgba(251, 191, 36, 0.22); }
        .officer-shift-btn.afternoon { border-color: rgba(59,130,246,0.55); color: #93c5fd; }
        .officer-shift-btn.afternoon:hover { background: rgba(59,130,246,0.16); transform: translateY(-4px); box-shadow: 0 14px 32px rgba(59, 130, 246, 0.22); }
        .officer-shift-btn:active { transform: translateY(-2px); }
        .officer-shift-btn-emoji { font-size: 2.6rem; transition: transform 0.3s; }
        .officer-shift-btn:hover .officer-shift-btn-emoji { transform: scale(1.12); }
        .officer-shift-btn-label { font-size: 1.1rem; font-weight: 600; }
        .officer-shift-btn-slots { font-size: 13px; opacity: 0.9; }
        .officer-waiting { padding: 34px 28px; background: rgba(254,252,232,0.07); border-radius: 22px; text-align: center; border: 1px solid rgba(253, 224, 71, 0.2); }
        .officer-waiting-emoji { display: block; font-size: 2.75rem; margin-bottom: 12px; animation: officer-pulse 1.5s ease-in-out infinite; }
        .officer-waiting-text { display: block; font-size: 1.2rem; font-weight: 600; color: #fde047; }
        .officer-waiting-hint { display: block; font-size: 14px; color: #a3a322; margin-top: 8px; }

        .officer-stats-title { margin: 0 0 18px; font-size: 1.1rem; font-weight: 700; color: rgba(255,255,255,0.95); }
        .officer-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .officer-stat { background: rgba(255,255,255,0.06); border-radius: 20px; padding: 20px; text-align: center; border-left: 4px solid; transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .officer-stat:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.18); }
        .officer-stat.morning { border-color: #fbbf24; }
        .officer-stat.afternoon { border-color: #3b82f6; }
        .officer-stat.fulltime { border-color: #8b5cf6; }
        .officer-stat.dayoff { border-color: #64748b; }
        .officer-stat-emoji { display: block; font-size: 1.6rem; margin-bottom: 8px; }
        .officer-stat-value { display: block; font-size: 1.75rem; font-weight: 700; color: white; }
        .officer-stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }

        .officer-history-title { margin: 0 0 18px; font-size: 1.1rem; font-weight: 700; color: rgba(255,255,255,0.95); }
        .officer-history-list { display: flex; flex-direction: column; gap: 12px; }
        .officer-history-item { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(255,255,255,0.05); border-radius: 16px; transition: background 0.2s, transform 0.2s; border: 1px solid rgba(255,255,255,0.05); }
        .officer-history-item:hover { background: rgba(255,255,255,0.08); transform: translateX(4px); }
        .officer-history-item:nth-child(1) { animation: officer-fadeUp 0.4s 0.05s both; }
        .officer-history-item:nth-child(2) { animation: officer-fadeUp 0.4s 0.1s both; }
        .officer-history-item:nth-child(3) { animation: officer-fadeUp 0.4s 0.15s both; }
        .officer-history-item:nth-child(4) { animation: officer-fadeUp 0.4s 0.2s both; }
        .officer-history-item:nth-child(5) { animation: officer-fadeUp 0.4s 0.25s both; }
        .officer-history-date { font-size: 15px; color: #94a3b8; }
        .officer-history-badge { padding: 8px 16px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .officer-history-badge.morning { background: rgba(251,191,36,0.22); color: #fcd34d; }
        .officer-history-badge.afternoon { background: rgba(59,130,246,0.22); color: #93c5fd; }
        .officer-history-badge.fulltime { background: rgba(139,92,246,0.22); color: #c4b5fd; }
        .officer-history-badge.dayoff, .officer-history-badge.vacation { background: rgba(255,255,255,0.1); color: #94a3b8; }
        .officer-history-empty { text-align: center; padding: 40px; color: #64748b; font-size: 15px; }

        .officer-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
        .officer-modal-overlay-in { animation: officer-fadeIn 0.3s ease-out; }
        .officer-modal { background: #1e293b; border-radius: 26px; width: 100%; max-width: 420px; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 28px 56px rgba(0,0,0,0.45); }
        .officer-modal-in { animation: officer-scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .officer-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .officer-modal-header h2 { margin: 0; font-size: 1.2rem; font-weight: 700; color: white; }
        .officer-modal-close { width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.08); border: none; color: #94a3b8; cursor: pointer; font-size: 1.1rem; transition: background 0.2s; }
        .officer-modal-close:hover { background: rgba(255,255,255,0.15); }
        .officer-profile-card { display: flex; align-items: center; gap: 20px; padding: 28px; background: linear-gradient(145deg, #0ea5e9 0%, #6366f1 100%); color: white; }
        .officer-profile-avatar { width: 64px; height: 64px; border-radius: 18px; background: rgba(255,255,255,0.22); display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 700; }
        .officer-profile-info h3 { margin: 0 0 10px; font-size: 1.2rem; font-weight: 700; }
        .officer-role-badge { background: rgba(255,255,255,0.28); padding: 6px 14px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .officer-profile-details { padding: 20px 24px; }
        .officer-detail-row { display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 15px; color: #cbd5e1; }
        .officer-detail-row:last-child { border-bottom: none; }
        .officer-status-active { color: #4ade80; font-weight: 600; }

        .officer-lock-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; padding: 20px; animation: officer-fadeIn 0.3s ease-out; }
        .officer-lock-card { background: rgba(30, 41, 59, 0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px 32px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 24px 48px rgba(0,0,0,0.4); animation: officer-scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .officer-lock-icon { font-size: 4rem; margin-bottom: 16px; }
        .officer-lock-title { margin: 0 0 12px; font-size: 1.5rem; font-weight: 700; color: white; }
        .officer-lock-text { margin: 0 0 24px; font-size: 15px; color: #94a3b8; line-height: 1.5; }
        .officer-lock-error { margin: 0 0 16px; font-size: 13px; color: #f87171; }
        .officer-lock-btn { display: block; width: 100%; padding: 18px 24px; border-radius: 16px; border: none; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.25s ease; margin-bottom: 12px; }
        .officer-lock-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-2px); }
        .officer-lock-btn:disabled { opacity: 0.8; cursor: not-allowed; }
        .officer-lock-logout { display: block; width: 100%; padding: 14px; border: none; background: transparent; color: #94a3b8; font-size: 14px; cursor: pointer; text-decoration: underline; }
        .officer-lock-logout:hover { color: #e2e8f0; }

        @media (max-width: 480px) {
          .officer-stats-grid { grid-template-columns: repeat(2, 1fr); }
          .officer-shift-buttons { grid-template-columns: 1fr; }
          .officer-main { padding: 18px; }
        }
      `}</style>
    </div>
  );
}
