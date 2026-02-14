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

// Somali instructions (audio / text-to-speech)
const SOMALI_INSTRUCTIONS: Record<OfficerTabId, string> = {
  "check-visa":
    "Boggan waa baarida fiisaha. Geli lambarka baasaboorka iyo lambarka tixraaca. Ka dib riix baar si aad u hesho fiisaha.",
  "check-payment":
    "Boggan waa baarida lacag bixinta. Geli lambarka siraaha rasiidka. Riix baar si aad u aragto rasiidka.",
  "scan-me":
    "Boggan waa skanerka QR. Tuur kaamera QR code ka rasiidka ama fiisaha. Kaliya QR ka immigration dot etas dot gov dot so ayaa loo aqbalay.",
  "my-shifts":
    "Halkan waxaad ka aragtaa shiftkaaga berri. Dooro aroorta ama galabta haddii la furo.",
};

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

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

  const logout = () => { localStorage.removeItem("currentUser"); localStorage.removeItem("sessionToken"); router.push("/"); };

  const playSomaliInstructions = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const text = SOMALI_INSTRUCTIONS[activeTab] || SOMALI_INSTRUCTIONS["my-shifts"];
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "so-SO";
    u.rate = 0.85;
    u.onstart = () => setSoundPlaying(true);
    u.onend = () => setSoundPlaying(false);
    u.onerror = () => setSoundPlaying(false);
    speechSynthRef.current = u;
    window.speechSynthesis.speak(u);
  };

  const stopSomaliInstructions = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSoundPlaying(false);
    }
  };

  useEffect(() => {
    return () => { stopSomaliInstructions(); };
  }, []);

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
      <header className="officer-header">
        <div className="officer-brand">
          <img src="/logo.svg" alt="" className="officer-logo-img" aria-hidden />
          <div className="officer-header-inner">
            <h1 className="officer-title">International Arrival</h1>
            <span className="officer-subtitle">Officer — Visa & shifts</span>
          </div>
        </div>
        <div className="officer-header-right">
          <button
            type="button"
            className={`officer-btn-icon officer-btn-sound ${soundPlaying ? "active" : ""}`}
            onClick={soundPlaying ? stopSomaliInstructions : playSomaliInstructions}
            aria-label={soundPlaying ? "Stop Somali instructions" : "Play Somali instructions"}
            title={soundPlaying ? "Stop instructions" : "Play instructions in Somali"}
          >
            {soundPlaying ? "⏹" : "🔊"}
          </button>
          <div className="officer-profile-wrap">
            <button
              type="button"
              className="officer-profile-btn"
              onClick={() => setProfileOpen((o) => !o)}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              aria-label="Profile menu"
            >
              <span className="officer-profile-avatar">{(user?.fullName || "?").charAt(0).toUpperCase()}</span>
            </button>
            {profileOpen && (
              <>
                <div className="officer-profile-backdrop" onClick={() => setProfileOpen(false)} aria-hidden />
                <div className="officer-profile-dropdown">
                  <div className="officer-profile-head">
                    <span className="officer-profile-name">{user?.fullName || "User"}</span>
                    <span className="officer-profile-role">Officer · {currentTime}</span>
                  </div>
                  <button type="button" className="officer-profile-item" onClick={() => { setProfileOpen(false); setShowProfile(true); }}>
                    Profile
                  </button>
                  <a href="/change-password" className="officer-profile-item" onClick={() => setProfileOpen(false)}>
                    Change password
                  </a>
                  <button type="button" className="officer-profile-item officer-profile-logout" onClick={() => { setProfileOpen(false); logout(); }}>
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {message && (
        <div className="officer-toast" role="alert" onClick={() => setMessage("")}>
          {message}
        </div>
      )}

      <main className="officer-main">
        <div className="officer-welcome-banner">
          <span className="officer-welcome-banner-text">Welcome back, <strong>{user?.fullName || "User"}</strong></span>
        </div>

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
            <OfficerScanView userId={user?.id} />
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
        @keyframes officer-fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes officer-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes officer-scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes officer-slideDown { from { opacity: 0; transform: translate(-50%, -12px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes officer-bgShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes officer-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.85; transform: scale(1.02); } }
        @keyframes officer-glow { 0%, 100% { box-shadow: 0 0 24px rgba(87, 255, 143, 0.4); } 50% { box-shadow: 0 0 32px rgba(87, 255, 143, 0.6); } }
        @keyframes officer-slideIn { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes officer-cardPop { from { opacity: 0; transform: translateY(28px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes officer-tabSlide { from { opacity: 0; transform: translateY(-8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes officer-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes officer-shine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes officer-emojiPop { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes officer-contentIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        .officer-page { position: relative; min-height: 100vh; min-height: 100dvh; width: 100%; max-width: 100vw; overflow-x: hidden; box-sizing: border-box; padding: clamp(8px, 3vw, 24px); padding-bottom: clamp(20px, 6vw, 48px); background: #f0f4f8; -webkit-overflow-scrolling: touch; color: #16364d; }
        .officer-loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .officer-loading-bg { position: absolute; inset: 0; background: #16364d; }
        .officer-loading-card { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 32px 48px; background: #16364d; border-radius: 24px; border: 2px solid rgba(87, 255, 143, 0.3); box-shadow: 0 16px 48px rgba(0,0,0,0.2); animation: officer-scaleIn 0.5s cubic-bezier(0.34, 1.2, 0.64, 1); }
        .loading-spinner { width: 44px; height: 44px; border: 3px solid rgba(87, 255, 143, 0.2); border-top-color: #57ff8f; border-radius: 50%; animation: officer-spin 0.7s linear infinite; }
        .officer-loading-text { font-size: 15px; color: #57ff8f; font-weight: 500; }

        .officer-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: clamp(16px, 4vw, 24px); padding: 14px 18px; background: #16364d; border-radius: 20px; border: 2px solid rgba(87, 255, 143, 0.25); box-shadow: 0 8px 24px rgba(22, 54, 77, 0.4); animation: officer-fadeUp 0.5s cubic-bezier(0.34, 1.2, 0.64, 1); }
        .officer-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .officer-logo-img { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; object-fit: contain; transition: transform 0.3s ease; filter: brightness(1.1); }
        .officer-brand:hover .officer-logo-img { transform: scale(1.05) rotate(-3deg); }
        .officer-header-inner { min-width: 0; }
        .officer-title { margin: 0; font-size: clamp(1.25rem, 4.5vw, 1.6rem); font-weight: 700; color: #57ff8f; letter-spacing: -0.02em; }
        .officer-subtitle { display: block; margin-top: 2px; font-size: clamp(0.8rem, 2.5vw, 0.9rem); color: rgba(87, 255, 143, 0.9); }
        .officer-header-right { display: flex; align-items: center; gap: 10px; }
        .officer-btn-icon { width: 44px; height: 44px; border-radius: 50%; border: 2px solid rgba(87, 255, 143, 0.5); background: #57ff8f; color: #16364d; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1); -webkit-tap-highlight-color: transparent; box-shadow: 0 4px 14px rgba(87, 255, 143, 0.4); }
        .officer-btn-icon:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(87, 255, 143, 0.5); background: #6bff9e; }
        .officer-btn-icon:active { transform: scale(0.95); transition-duration: 0.1s; }
        .officer-btn-sound { font-size: 1.2rem; }
        .officer-btn-sound.active { background: #57ff8f; color: #16364d; box-shadow: 0 0 20px rgba(87, 255, 143, 0.5); animation: officer-glow 2s ease-in-out infinite; }
        .officer-profile-wrap { position: relative; }
        .officer-profile-btn { width: 44px; height: 44px; border-radius: 50%; border: 2px solid #57ff8f; background: #16364d; color: #57ff8f; font-size: 1.1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1); -webkit-tap-highlight-color: transparent; box-shadow: 0 4px 14px rgba(87, 255, 143, 0.2); }
        .officer-profile-btn:hover { transform: scale(1.08); background: rgba(87, 255, 143, 0.15); box-shadow: 0 6px 20px rgba(87, 255, 143, 0.3); }
        .officer-profile-avatar { line-height: 1; }
        .officer-profile-backdrop { position: fixed; inset: 0; z-index: 98; background: transparent; }
        .officer-profile-dropdown { position: absolute; top: calc(100% + 8px); right: 0; min-width: 200px; background: #16364d; border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.3); border: 2px solid rgba(87, 255, 143, 0.3); z-index: 99; overflow: hidden; animation: officer-dropdownIn 0.25s cubic-bezier(0.34, 1.2, 0.64, 1); }
        @keyframes officer-dropdownIn { from { opacity: 0; transform: translateY(-10px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .officer-profile-head { padding: 14px 16px; border-bottom: 1px solid rgba(87, 255, 143, 0.2); }
        .officer-profile-name { display: block; font-size: 0.95rem; font-weight: 700; color: #57ff8f; }
        .officer-profile-role { display: block; font-size: 0.75rem; color: rgba(87, 255, 143, 0.85); margin-top: 2px; }
        .officer-profile-item { display: block; width: 100%; padding: 12px 16px; text-align: left; font-size: 0.9rem; font-weight: 500; color: rgba(255,255,255,0.9); text-decoration: none; border: none; background: none; cursor: pointer; transition: all 0.2s; }
        .officer-profile-item:hover { background: rgba(87, 255, 143, 0.15); color: #57ff8f; }
        .officer-profile-logout { color: #ff6b6b; }
        .officer-profile-logout:hover { background: rgba(255, 107, 107, 0.15); color: #ff8787; }

        .officer-toast { position: fixed; top: max(16px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); padding: 12px 20px; background: #16364d; color: #57ff8f; border-radius: 14px; font-size: 0.9rem; max-width: min(90vw, 360px); z-index: 100; cursor: pointer; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border: 2px solid rgba(87, 255, 143, 0.3); animation: officer-slideDown 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); }

        .officer-main { width: 100%; max-width: min(560px, calc(100vw - 20px)); margin: 0 auto; box-sizing: border-box; background: #fff; border-radius: 28px; padding: clamp(18px, 4vw, 28px); padding-bottom: 140px; border: 2px solid rgba(22, 54, 77, 0.15); box-shadow: 0 12px 40px rgba(22, 54, 77, 0.12); animation: officer-mainIn 0.6s cubic-bezier(0.34, 1.2, 0.64, 1); }
        @keyframes officer-mainIn { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .officer-welcome-banner { padding: 16px 20px; margin-bottom: 22px; border-radius: 18px; background: #16364d; border: 2px solid rgba(87, 255, 143, 0.3); box-shadow: 0 4px 20px rgba(22, 54, 77, 0.2); animation: officer-fadeUp 0.5s 0.1s cubic-bezier(0.34, 1.2, 0.64, 1) both; }
        .officer-welcome-banner-text { font-size: 0.95rem; color: rgba(255,255,255,0.95); }
        .officer-welcome-banner-text strong { color: #57ff8f; font-weight: 700; }

        .officer-tabs { padding: clamp(12px, 3vw, 16px) 0; margin-bottom: 12px; border-bottom: 2px solid rgba(22, 54, 77, 0.12); overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
        .officer-tabs-inner { display: flex; gap: 10px; min-width: min-content; flex-wrap: wrap; }
        .officer-tab { display: flex; align-items: center; gap: 10px; padding: clamp(12px, 3vw, 14px) clamp(16px, 4vw, 20px); border-radius: 16px; border: 2px solid rgba(22, 54, 77, 0.2); background: #f0f4f8; color: #16364d; font-size: clamp(14px, 2.5vw, 15px); font-weight: 600; cursor: pointer; transition: all 0.35s cubic-bezier(0.34, 1.2, 0.64, 1); white-space: nowrap; }
        .officer-tab:hover { background: rgba(87, 255, 143, 0.15); color: #0d2d42; transform: translateY(-2px); border-color: rgba(87, 255, 143, 0.4); }
        .officer-tab.active { background: #57ff8f; color: #16364d; border-color: #57ff8f; box-shadow: 0 4px 16px rgba(87, 255, 143, 0.35); animation: officer-tabSlide 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); }
        .officer-tab-icon { font-size: 1.2rem; transition: transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1); }
        .officer-tab.active .officer-tab-icon { transform: scale(1.12); animation: officer-emojiPop 0.5s ease; }
        .officer-anim-in { animation: officer-cardPop 0.6s cubic-bezier(0.34, 1.2, 0.64, 1) forwards; }
        .officer-anim-delay-1 { animation-delay: 0.12s; opacity: 0; }
        .officer-anim-delay-2 { animation-delay: 0.24s; opacity: 0; }
        .officer-card { background: linear-gradient(145deg, #fff 0%, #f8fafc 100%); border-radius: 22px; padding: clamp(20px, 4vw, 28px); margin-bottom: 24px; border: 2px solid rgba(22, 54, 77, 0.12); transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); box-shadow: 0 4px 20px rgba(22, 54, 77, 0.08); }
        .officer-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(22, 54, 77, 0.15); border-color: rgba(87, 255, 143, 0.3); }
        .officer-card-title { margin: 0 0 8px; font-size: 1.3rem; font-weight: 700; color: #16364d; letter-spacing: -0.03em; }
        .officer-card-sub { margin: 0 0 24px; font-size: 14px; color: #475569; line-height: 1.5; }
        .officer-form { display: flex; flex-direction: column; gap: 22px; }
        .officer-field { display: flex; flex-direction: column; gap: 10px; }
        .officer-label { font-size: 14px; font-weight: 600; color: #16364d; }
        .officer-input { padding: clamp(14px, 3vw, 18px) clamp(16px, 4vw, 20px); border-radius: 16px; border: 2px solid rgba(22, 54, 77, 0.2); background: #fff; color: #16364d; font-size: clamp(15px, 2.5vw, 16px); transition: all 0.3s ease; }
        .officer-input:focus { outline: none; border-color: #57ff8f; box-shadow: 0 0 0 3px rgba(87, 255, 143, 0.25); }
        .officer-input::placeholder { color: #94a3b8; }
        .officer-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 400px) { .officer-row { grid-template-columns: 1fr; } }
        .officer-btn-primary { padding: 20px 30px; border-radius: 18px; border: none; background: #57ff8f; color: #16364d; font-size: 17px; font-weight: 700; cursor: pointer; transition: all 0.35s cubic-bezier(0.34, 1.2, 0.64, 1); box-shadow: 0 6px 24px rgba(87, 255, 143, 0.4); }
        .officer-btn-primary:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(87, 255, 143, 0.5); background: #6bff9e; }
        .officer-btn-primary:active:not(:disabled) { transform: translateY(0) scale(0.98); transition-duration: 0.1s; }
        .officer-btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        .officer-scan-section { margin-bottom: 24px; background: #16364d; border-radius: 22px; border: 2px solid rgba(87, 255, 143, 0.25); padding: 8px; transition: all 0.4s ease; }
        .officer-scan-section:hover { border-color: rgba(87, 255, 143, 0.45); box-shadow: 0 8px 28px rgba(22, 54, 77, 0.25); }
        .officer-scan-section-header { padding: 22px 24px 8px; }
        .officer-scan-section-title { margin: 0 0 6px; font-size: 1.28rem; font-weight: 700; color: #57ff8f; letter-spacing: -0.02em; }
        .officer-scan-section-sub { margin: 0; font-size: 13px; color: rgba(87, 255, 143, 0.9); line-height: 1.45; }
        .officer-scan-loading { padding: 40px; text-align: center; color: rgba(87, 255, 143, 0.8); }

        .officer-hero { text-align: center; }
        .officer-hero-label { font-size: 14px; color: #16364d; margin-bottom: 24px; letter-spacing: 0.03em; }
        .officer-shift-badge { padding: 36px 30px; border-radius: 24px; transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); position: relative; overflow: hidden; }
        .officer-shift-badge::before { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, transparent 0%, rgba(87, 255, 143, 0.1) 100%); opacity: 0; transition: opacity 0.4s; }
        .officer-shift-badge:hover { transform: translateY(-6px) scale(1.02); }
        .officer-shift-badge:hover::before { opacity: 1; }
        .officer-shift-badge.morning { background: linear-gradient(135deg, rgba(87, 255, 143, 0.35), rgba(87, 255, 143, 0.2)); border: 2px solid rgba(87, 255, 143, 0.5); box-shadow: 0 12px 32px rgba(87, 255, 143, 0.2); color: #16364d; }
        .officer-shift-badge.morning:hover { box-shadow: 0 16px 40px rgba(87, 255, 143, 0.3); }
        .officer-shift-badge.afternoon { background: linear-gradient(135deg, #16364d 0%, #1e4a6a 100%); border: 2px solid rgba(87, 255, 143, 0.4); box-shadow: 0 12px 32px rgba(22, 54, 77, 0.3); color: #57ff8f; }
        .officer-shift-badge.afternoon:hover { box-shadow: 0 16px 40px rgba(87, 255, 143, 0.2); }
        .officer-shift-badge.fulltime { background: linear-gradient(135deg, #1a3d52 0%, #16364d 100%); border: 2px solid rgba(87, 255, 143, 0.35); box-shadow: 0 12px 32px rgba(22, 54, 77, 0.3); color: #57ff8f; }
        .officer-shift-badge.fulltime:hover { box-shadow: 0 16px 40px rgba(87, 255, 143, 0.2); }
        .officer-shift-badge.dayoff, .officer-shift-badge.vacation { background: linear-gradient(145deg, #f0f4f8 0%, #e2e8f0 100%); border: 2px solid rgba(22, 54, 77, 0.2); color: #16364d; }
        .officer-shift-emoji { display: block; font-size: 3rem; margin-bottom: 12px; animation: officer-emojiPop 0.6s cubic-bezier(0.34, 1.2, 0.64, 1); transition: transform 0.4s ease; }
        .officer-shift-badge:hover .officer-shift-emoji { transform: scale(1.15); }
        .officer-shift-text { display: block; font-size: 1.7rem; font-weight: 700; color: inherit; letter-spacing: -0.03em; }
        .officer-shift-hint { display: block; font-size: 14px; color: inherit; margin-top: 8px; opacity: 0.9; }
        .officer-choose-prompt { color: #16364d; margin-bottom: 20px; font-size: 15px; }
        .officer-shift-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .officer-shift-btn { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 28px 20px; border-radius: 22px; border: 2px solid; cursor: pointer; transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); background: #fff; }
        .officer-shift-btn.morning { border-color: #57ff8f; color: #16364d; background: rgba(87, 255, 143, 0.12); }
        .officer-shift-btn.morning:hover { background: rgba(87, 255, 143, 0.25); transform: translateY(-5px); box-shadow: 0 12px 32px rgba(87, 255, 143, 0.3); }
        .officer-shift-btn.morning .officer-shift-btn-emoji { animation: officer-float 3s ease-in-out infinite; }
        .officer-shift-btn.afternoon { border-color: #16364d; color: #16364d; background: rgba(22, 54, 77, 0.06); }
        .officer-shift-btn.afternoon:hover { background: rgba(22, 54, 77, 0.12); transform: translateY(-5px); box-shadow: 0 12px 32px rgba(22, 54, 77, 0.2); border-color: #57ff8f; }
        .officer-shift-btn.afternoon .officer-shift-btn-emoji { animation: officer-float 3s ease-in-out infinite 0.5s; }
        .officer-shift-btn:active { transform: translateY(-2px) scale(0.98); }
        .officer-shift-btn-emoji { font-size: 2.6rem; transition: transform 0.4s; }
        .officer-shift-btn:hover .officer-shift-btn-emoji { transform: scale(1.2); }
        .officer-shift-btn-label { font-size: 1.1rem; font-weight: 600; }
        .officer-shift-btn-slots { font-size: 13px; color: #16364d; opacity: 0.8; }
        .officer-waiting { padding: 34px 28px; background: #16364d; border-radius: 22px; text-align: center; border: 2px solid rgba(87, 255, 143, 0.3); transition: all 0.4s ease; }
        .officer-waiting:hover { border-color: rgba(87, 255, 143, 0.5); box-shadow: 0 8px 24px rgba(22, 54, 77, 0.25); }
        .officer-waiting-emoji { display: block; font-size: 2.75rem; margin-bottom: 12px; animation: officer-pulse 1.8s ease-in-out infinite; }
        .officer-waiting-text { display: block; font-size: 1.2rem; font-weight: 600; color: #57ff8f; }
        .officer-waiting-hint { display: block; font-size: 14px; color: rgba(87, 255, 143, 0.9); margin-top: 8px; }

        .officer-stats-title { margin: 0 0 18px; font-size: 1.1rem; font-weight: 700; color: #16364d; }
        .officer-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .officer-stat { background: #fff; border-radius: 18px; padding: clamp(16px, 3vw, 20px); text-align: center; border: 2px solid rgba(22, 54, 77, 0.12); border-left: 4px solid #57ff8f; transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); box-shadow: 0 2px 12px rgba(22, 54, 77, 0.06); }
        .officer-stat:hover { transform: translateY(-4px); box-shadow: 0 12px 28px rgba(87, 255, 143, 0.15); border-color: rgba(87, 255, 143, 0.3); }
        .officer-stat.morning { border-left-color: #57ff8f; background: linear-gradient(145deg, rgba(87, 255, 143, 0.08) 0%, #fff 100%); }
        .officer-stat.afternoon { border-left-color: #16364d; background: linear-gradient(145deg, rgba(22, 54, 77, 0.06) 0%, #fff 100%); }
        .officer-stat.fulltime { border-left-color: #16364d; background: linear-gradient(145deg, rgba(22, 54, 77, 0.08) 0%, #fff 100%); }
        .officer-stat.dayoff { border-left-color: rgba(22, 54, 77, 0.4); background: #f8fafc; }
        .officer-stat-emoji { display: block; font-size: 1.6rem; margin-bottom: 8px; transition: transform 0.4s ease; }
        .officer-stat:hover .officer-stat-emoji { transform: scale(1.2); }
        .officer-stat-value { display: block; font-size: 1.75rem; font-weight: 700; color: #16364d; }
        .officer-stat-label { font-size: 11px; color: #16364d; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em; }

        .officer-history-title { margin: 0 0 18px; font-size: 1.1rem; font-weight: 700; color: #16364d; }
        .officer-history-list { display: flex; flex-direction: column; gap: 12px; }
        .officer-history-item { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f0f4f8; border-radius: 16px; transition: all 0.35s cubic-bezier(0.34, 1.2, 0.64, 1); border: 2px solid transparent; }
        .officer-history-item:hover { background: rgba(87, 255, 143, 0.12); transform: translateX(6px); border-color: rgba(87, 255, 143, 0.25); }
        .officer-history-item:nth-child(1) { animation: officer-fadeUp 0.45s 0.05s both; }
        .officer-history-item:nth-child(2) { animation: officer-fadeUp 0.45s 0.1s both; }
        .officer-history-item:nth-child(3) { animation: officer-fadeUp 0.45s 0.15s both; }
        .officer-history-item:nth-child(4) { animation: officer-fadeUp 0.45s 0.2s both; }
        .officer-history-item:nth-child(5) { animation: officer-fadeUp 0.45s 0.25s both; }
        .officer-history-date { font-size: 15px; color: #16364d; }
        .officer-history-badge { padding: 8px 16px; border-radius: 12px; font-size: 12px; font-weight: 600; transition: transform 0.3s ease; }
        .officer-history-item:hover .officer-history-badge { transform: scale(1.05); }
        .officer-history-badge.morning { background: rgba(87, 255, 143, 0.3); color: #16364d; }
        .officer-history-badge.afternoon { background: #16364d; color: #57ff8f; }
        .officer-history-badge.fulltime { background: #16364d; color: #57ff8f; }
        .officer-history-badge.dayoff, .officer-history-badge.vacation { background: rgba(22, 54, 77, 0.15); color: #16364d; }
        .officer-history-empty { text-align: center; padding: 40px; color: #16364d; font-size: 15px; opacity: 0.8; }

        .officer-modal-overlay { position: fixed; inset: 0; background: rgba(22, 54, 77, 0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
        .officer-modal-overlay-in { animation: officer-fadeIn 0.3s ease-out; }
        .officer-modal { background: #fff; border-radius: 24px; width: 100%; max-width: 420px; overflow: hidden; border: 2px solid rgba(22, 54, 77, 0.15); box-shadow: 0 24px 56px rgba(22, 54, 77, 0.25); }
        .officer-modal-in { animation: officer-scaleIn 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); }
        .officer-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 2px solid rgba(22, 54, 77, 0.1); background: #16364d; }
        .officer-modal-header h2 { margin: 0; font-size: 1.2rem; font-weight: 700; color: #57ff8f; }
        .officer-modal-close { width: 44px; height: 44px; border-radius: 14px; background: rgba(87, 255, 143, 0.2); border: none; color: #57ff8f; cursor: pointer; font-size: 1.1rem; transition: all 0.3s; }
        .officer-modal-close:hover { background: rgba(87, 255, 143, 0.35); color: #fff; }
        .officer-profile-card { display: flex; align-items: center; gap: 20px; padding: 28px; background: #16364d; border-bottom: 2px solid rgba(87, 255, 143, 0.2); color: #57ff8f; }
        .officer-profile-avatar { width: 64px; height: 64px; border-radius: 18px; background: rgba(87, 255, 143, 0.2); color: #16364d; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 700; }
        .officer-profile-info h3 { margin: 0 0 10px; font-size: 1.2rem; font-weight: 700; color: #57ff8f; }
        .officer-role-badge { background: rgba(87, 255, 143, 0.25); color: #16364d; padding: 6px 14px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .officer-profile-details { padding: 20px 24px; }
        .officer-detail-row { display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid rgba(22, 54, 77, 0.1); font-size: 15px; color: #16364d; }
        .officer-detail-row:last-child { border-bottom: none; }
        .officer-status-active { color: #57ff8f; font-weight: 600; }

        .officer-lock-overlay { position: fixed; inset: 0; z-index: 300; background: #16364d; backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; padding: 20px; animation: officer-fadeIn 0.3s ease-out; }
        .officer-lock-card { background: #16364d; border: 2px solid rgba(87, 255, 143, 0.3); border-radius: 24px; padding: 40px 32px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 24px 48px rgba(0,0,0,0.3); animation: officer-scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .officer-lock-icon { font-size: 4rem; margin-bottom: 16px; }
        .officer-lock-title { margin: 0 0 12px; font-size: 1.5rem; font-weight: 700; color: #57ff8f; }
        .officer-lock-text { margin: 0 0 24px; font-size: 15px; color: rgba(87, 255, 143, 0.9); line-height: 1.5; }
        .officer-lock-error { margin: 0 0 16px; font-size: 13px; color: #ff6b6b; }
        .officer-lock-btn { display: block; width: 100%; padding: 18px 24px; border-radius: 16px; border: none; background: #57ff8f; color: #16364d; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.25s ease; margin-bottom: 12px; }
        .officer-lock-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(87, 255, 143, 0.4); }
        .officer-lock-btn:disabled { opacity: 0.8; cursor: not-allowed; }
        .officer-lock-logout { display: block; width: 100%; padding: 14px; border: none; background: transparent; color: rgba(87, 255, 143, 0.9); font-size: 14px; cursor: pointer; text-decoration: underline; }
        .officer-lock-logout:hover { color: #57ff8f; }
        
        @media (max-width: 600px) {
          .officer-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .officer-stat-value { font-size: 1.5rem; }
        }
        @media (max-width: 480px) {
          .officer-shift-buttons { grid-template-columns: 1fr; }
          .officer-main { padding: 14px 12px 120px; }
          .officer-header { padding: 12px 14px; }
          .officer-logo-img { width: 38px; height: 38px; }
          .officer-title { font-size: 1rem; }
          .officer-tab { padding: 12px 16px; }
          .officer-card { padding: 18px; margin-bottom: 18px; }
          .officer-hero-label { font-size: 13px; }
          .officer-shift-badge { padding: 24px 20px; }
          .officer-shift-text { font-size: 1.4rem; }
        }
        @media (max-width: 360px) {
          .officer-stats-grid { gap: 10px; }
          .officer-stat { padding: 14px; }
          .officer-stat-emoji { font-size: 1.4rem; }
          .officer-stat-value { font-size: 1.35rem; }
        }
      `}</style>
    </div>
  );
}
