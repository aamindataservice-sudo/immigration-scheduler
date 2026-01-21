"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMogadishuTomorrowISO } from "@/lib/time";

type Shift = {
  id: string;
  date: string;
  type: string;
};

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
    if (parsed.role !== "OFFICER") {
      router.push("/");
      return;
    }
    setUser(parsed);
  }, [router]);

  const loadHistory = async (userId: string) => {
    const res = await fetch(`/api/shifts/my-shifts?userId=${userId}`);
    const data = await res.json();
    if (data.ok) setHistory(data.shifts);
  };

  const loadScheduleStatus = async () => {
    const res = await fetch(`/api/shifts/status?date=${tomorrow}`);
    const data = await res.json();
    if (data.ok) {
      setCanChoose(data.choicesOpen);
      setChoiceReason(data.reason ?? null);
    }
  };

  const loadAssigned = async (userId: string) => {
    const res = await fetch(`/api/shifts/my-day?userId=${userId}&date=${tomorrow}`);
    const data = await res.json();
    if (data.ok) setAssigned(data.shift);
  };

  const loadRule = async () => {
    const res = await fetch(`/api/rules/get?date=${tomorrow}`);
    const data = await res.json();
    if (data.ok && data.rule) {
      setMorningLimit(data.rule.morningLimit);
      setAfternoonLimit(data.rule.afternoonLimit);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadHistory(user.id);
      loadScheduleStatus();
      loadAssigned(user.id);
      loadRule();
    }
  }, [user]);

  const choose = async (choice: "MORNING" | "AFTERNOON") => {
    setMessage("");
    const res = await fetch("/api/shifts/choose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, date: tomorrow, choice }),
    });
    const data = await res.json();
    if (data.ok) {
      setMessage("Choice saved.");
    } else {
      setMessage(data.error || "Failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <header className="page-header">
          <div>
            <span className="badge badge-primary">Officer</span>
            <h1 style={{ margin: "8px 0 4px", fontSize: "1.5rem", fontWeight: 700 }}>
              My Shifts
            </h1>
            <p className="muted">Welcome, {user?.fullName}</p>
          </div>
          <button className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </header>

        {message && (
          <div className="toast" onClick={() => setMessage("")}>
            {message}
          </div>
        )}

        {/* Tomorrow's Schedule Card */}
        <div className="card">
          <h3 className="card-title">📅 Tomorrow&apos;s Schedule</h3>
          <p className="muted" style={{ marginBottom: 16 }}>{tomorrow}</p>

          {!assigned && canChoose && (
            <>
              <p style={{ marginBottom: 16 }}>
                No schedule assigned yet. Choose your preferred shift:
              </p>
              <div className="shift-choice-grid">
                <button className="shift-card morning" onClick={() => choose("MORNING")}>
                  <span className="shift-icon">🌅</span>
                  <span className="shift-name">Morning</span>
                  <span className="shift-limit">Limit: {morningLimit}</span>
                </button>
                <button className="shift-card afternoon" onClick={() => choose("AFTERNOON")}>
                  <span className="shift-icon">🌇</span>
                  <span className="shift-name">Afternoon</span>
                  <span className="shift-limit">Limit: {afternoonLimit}</span>
                </button>
              </div>
            </>
          )}

          {!canChoose && !assigned && (
            <div className="status-box warn">
              <span className="status-icon">⏰</span>
              <div>
                <strong>Choices Closed</strong>
                <p>
                  {choiceReason === "cutoff-passed"
                    ? "The deadline has passed. Await auto-generated schedule."
                    : "Schedule is being generated. Please wait."}
                </p>
              </div>
            </div>
          )}

          {assigned && (
            <div className={`status-box ${assigned.type === "MORNING" ? "success" : assigned.type === "AFTERNOON" ? "info" : "warn"}`}>
              <span className="status-icon">
                {assigned.type === "MORNING" ? "🌅" : assigned.type === "AFTERNOON" ? "🌇" : assigned.type === "FULLTIME" ? "⏰" : "🏠"}
              </span>
              <div>
                <strong>Your Shift</strong>
                <p className="assigned-shift">{assigned.type}</p>
              </div>
            </div>
          )}
        </div>

        {/* History Card */}
        <div className="card">
          <h3 className="card-title">📋 Recent Shifts</h3>
          <div className="table-wrapper" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shift</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr>
                    <td colSpan={2} className="muted" style={{ textAlign: "center", padding: 24 }}>
                      No shifts recorded yet.
                    </td>
                  </tr>
                )}
                {history.map((s) => (
                  <tr key={s.id}>
                    <td>{String(s.date).slice(0, 10)}</td>
                    <td>
                      <span className={`pattern-badge ${s.type === "MORNING" ? "dayoff" : s.type === "AFTERNOON" ? "fulltime" : "locked"}`}>
                        {s.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        .shift-choice-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
        }

        .shift-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 24px 16px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .shift-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }

        .shift-card.morning {
          border-color: #fbbf24;
        }

        .shift-card.morning:hover {
          background: #fffbeb;
          border-color: #f59e0b;
        }

        .shift-card.afternoon {
          border-color: #3b82f6;
        }

        .shift-card.afternoon:hover {
          background: #eff6ff;
          border-color: #2563eb;
        }

        .shift-icon {
          font-size: 2.5rem;
        }

        .shift-name {
          font-size: 1.1rem;
          font-weight: 600;
        }

        .shift-limit {
          font-size: 12px;
          color: #64748b;
        }

        .status-box {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .status-box.success {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .status-box.info {
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .status-box.warn {
          background: #fffbeb;
          border-color: #fef3c7;
        }

        .status-icon {
          font-size: 2rem;
        }

        .status-box strong {
          display: block;
          font-size: 14px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .status-box p {
          color: #334155;
          margin: 0;
        }

        .assigned-shift {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f172a;
        }
      `}</style>
    </div>
  );
}
