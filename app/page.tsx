"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [phone, setPhone] = useState("252");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [setupError, setSetupError] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupPhone, setSetupPhone] = useState("252");
  const [setupPassword, setSetupPassword] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("currentUser");
    if (raw) {
      const user = JSON.parse(raw);
      if (user.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push(user.role === "ADMIN" ? "/admin" : "/officer");
      }
      return;
    }
    fetch("/api/auth/bootstrap")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setHasAdmin(data.hasAdmin);
        else setHasAdmin(true);
      })
      .catch(() => setHasAdmin(true));
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Login failed");
        return;
      }
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      if (data.user.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push(data.user.role === "ADMIN" ? "/admin" : "/officer");
      }
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const setupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError("");
    setSetupLoading(true);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: setupName, phone: setupPhone, password: setupPassword }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSetupError(data.error || "Setup failed");
        return;
      }
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      router.push("/change-password");
    } catch (err: any) {
      setSetupError(err?.message ?? "Setup failed");
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🛫</div>
          <h1>Immigration Scheduler</h1>
          <p>Manage officer shifts efficiently</p>
        </div>

        {hasAdmin === null && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div className="spinner"></div>
            <p className="muted">Loading...</p>
          </div>
        )}

        {hasAdmin === false && (
          <div className="auth-form-section">
            <h2>Initial Setup</h2>
            <p className="muted" style={{ marginBottom: 20 }}>
              Create your admin account to get started.
            </p>
            <form onSubmit={setupAdmin}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="input"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  placeholder="Administrator"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="input"
                  value={setupPhone}
                  onChange={(e) => setSetupPhone(e.target.value)}
                  placeholder="252xxxxxxxxx"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="Leave empty for admin123"
                />
              </div>
              {setupError && <div className="error-box">{setupError}</div>}
              <button className="btn btn-primary btn-block btn-lg" disabled={setupLoading}>
                {setupLoading ? "Creating..." : "Create Admin Account"}
              </button>
            </form>
          </div>
        )}

        {hasAdmin === true && (
          <div className="auth-form-section">
            <form onSubmit={submit}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="252xxxxxxxxx"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              {error && <div className="error-box">{error}</div>}
              <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
            <div className="auth-help">
              <p>
                <strong>Default passwords:</strong>
              </p>
              <p>Admin: <code>admin123</code></p>
              <p>Officers: <code>officer123</code></p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
        }

        .auth-card {
          max-width: 400px;
          width: 100%;
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .auth-logo {
          font-size: 3rem;
          margin-bottom: 12px;
        }

        .auth-header h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 4px;
          color: #0f172a;
        }

        .auth-header p {
          color: #64748b;
          font-size: 14px;
        }

        .auth-form-section h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          margin-bottom: 6px;
        }

        .input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 15px;
          transition: all 0.15s ease;
        }

        .input:focus {
          outline: none;
          border-color: #3b82f6;
          background: white;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .error-box {
          padding: 12px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          color: #b91c1c;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .btn-lg {
          padding: 14px 20px;
          font-size: 15px;
        }

        .btn-block {
          width: 100%;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .auth-help {
          margin-top: 24px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 10px;
          font-size: 13px;
          color: #64748b;
        }

        .auth-help p {
          margin: 4px 0;
        }

        .auth-help code {
          background: #e2e8f0;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: #334155;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e2e8f0;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 12px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 480px) {
          .auth-card {
            padding: 24px;
            border-radius: 12px;
          }

          .auth-header h1 {
            font-size: 1.25rem;
          }

          .input {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}
