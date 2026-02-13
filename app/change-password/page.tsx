"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("currentUser");
    if (!raw) {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        router.replace("/");
      }
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setUser(parsed);
    } catch {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        router.replace("/");
      }
    } finally {
      setReady(true);
    }
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!newPassword || newPassword.length < 3) {
      setError("New password must be at least 3 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          currentPassword: user?.mustChangePassword ? undefined : currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to update password.");
        return;
      }
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      if (data.user.role === "ADMIN") router.push("/admin");
      else if (data.user.role === "CHECKER") router.push("/workspace");
      else if (data.user.role === "SUPER_ADMIN") router.push("/super-admin");
      else router.push("/officer");
    } catch (err: any) {
      setError(err?.message ?? "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  if (!ready) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <p style={{ margin: 0, color: "#64748b", fontSize: "1rem" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/logo.svg" alt="International Arrival System" className="auth-logo-img" />
          <h1>Set Your Password</h1>
          <p>
            {user?.mustChangePassword
              ? "Create a new password for your account"
              : "Update your current password"}
          </p>
        </div>

        <form onSubmit={submit} className="auth-form-section">
          {!user?.mustChangePassword && (
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                className="input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? "Saving..." : "Save Password"}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={logout}>
            Logout
          </button>
        </form>
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

        .auth-logo-img {
          width: 56px;
          height: 56px;
          margin: 0 auto 12px;
          display: block;
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

        .btn {
          padding: 12px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-lg {
          padding: 14px 20px;
          font-size: 15px;
        }

        .btn-block {
          width: 100%;
          margin-bottom: 8px;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-ghost {
          background: transparent;
          color: #64748b;
        }

        .btn-ghost:hover {
          background: #f1f5f9;
          color: #334155;
        }

        @media (max-width: 480px) {
          .auth-card {
            padding: 24px;
            border-radius: 12px;
          }

          .input {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}
