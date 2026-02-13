"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [privilege, setPrivilege] = useState<any>(null);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
    } catch {
      router.push("/");
      return;
    }
    if (!raw) {
      router.push("/");
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      router.push("/");
      return;
    }
    if (parsed.mustChangePassword) {
      router.push("/change-password");
      return;
    }
    
    // Standard roles use their dedicated pages
    if (parsed.role === "SUPER_ADMIN") {
      router.push("/super-admin");
      return;
    }
    if (parsed.role === "ADMIN") {
      router.push("/admin");
      return;
    }
    if (parsed.role === "OFFICER") {
      router.push("/officer");
      return;
    }
    
    setUser(parsed);
    
    // Fetch privileges
    fetch(`/api/auth/my-privileges?userId=${parsed.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.privilege) {
          setPrivilege(data.privilege);
        } else {
          // No privileges, send to workspace (checker UI)
          router.push("/workspace");
        }
      })
      .catch(() => {
        router.push("/workspace");
      });
  }, [router]);

  const logout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  if (!user || !privilege) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)" }}>
        <div style={{ color: "white", fontSize: "18px" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div className="header-left">
          <img src="/logo.svg" alt="" className="header-logo" />
          <div className="user-avatar">{user?.fullName?.charAt(0)?.toUpperCase() || "U"}</div>
          <div className="user-info">
            <h1>{user?.fullName}</h1>
            <span className="role-badge">Custom Access</span>
          </div>
        </div>
        <button className="btn-logout" onClick={logout}>
          🚪 Logout
        </button>
      </header>

      <main className="main-content">
        <h2 className="page-title">My Authorized Features</h2>
        <p className="page-subtitle">You have access to the following features based on your privileges</p>

        <div className="features-grid">
          {/* Payment Checking */}
          {privilege.canCheckPayment && (
            <div className="feature-card" onClick={() => router.push("/workspace")}>
              <div className="feature-icon">💳</div>
              <div className="feature-title">Check Payment</div>
              <div className="feature-desc">Verify payment receipts</div>
            </div>
          )}

          {privilege.canCheckEVisa && (
            <div className="feature-card" onClick={() => router.push("/workspace")}>
              <div className="feature-icon">📄</div>
              <div className="feature-title">Check E-Visa</div>
              <div className="feature-desc">Verify e-Visa status</div>
            </div>
          )}

          {privilege.canCreateUser && (
            <div className="feature-card" onClick={() => router.push("/admin")}>
              <div className="feature-icon">👤</div>
              <div className="feature-title">Create Users</div>
              <div className="feature-desc">Add new team members</div>
            </div>
          )}

          {privilege.canUpdateUser && (
            <div className="feature-card" onClick={() => router.push("/admin")}>
              <div className="feature-icon">✏️</div>
              <div className="feature-title">Update Users</div>
              <div className="feature-desc">Edit user information</div>
            </div>
          )}

          {privilege.canDeleteUser && (
            <div className="feature-card" onClick={() => router.push("/admin")}>
              <div className="feature-icon">🗑️</div>
              <div className="feature-title">Delete Users</div>
              <div className="feature-desc">Remove team members</div>
            </div>
          )}

          {privilege.canResetPassword && (
            <div className="feature-card" onClick={() => router.push("/admin")}>
              <div className="feature-icon">🔑</div>
              <div className="feature-title">Reset Passwords</div>
              <div className="feature-desc">Reset user passwords</div>
            </div>
          )}

          {privilege.canManageSchedules && (
            <div className="feature-card" onClick={() => router.push("/admin")}>
              <div className="feature-icon">📅</div>
              <div className="feature-title">Manage Schedules</div>
              <div className="feature-desc">Create and edit shifts</div>
            </div>
          )}

          {privilege.canManagePatterns && (
            <div className="feature-card" onClick={() => router.push("/admin")}>
              <div className="feature-icon">🔄</div>
              <div className="feature-title">Manage Patterns</div>
              <div className="feature-desc">Set weekly rules</div>
            </div>
          )}

          {privilege.canApproveVacations && (
            <div className="feature-card" onClick={() => router.push("/admin")}>
              <div className="feature-icon">🏖️</div>
              <div className="feature-title">Approve Vacations</div>
              <div className="feature-desc">Manage leave requests</div>
            </div>
          )}

          {privilege.canViewReports && (
            <div className="feature-card" onClick={() => router.push("/admin")}>
              <div className="feature-icon">📊</div>
              <div className="feature-title">View Reports</div>
              <div className="feature-desc">Access analytics</div>
            </div>
          )}

          {privilege.canViewPaymentHistory && (
            <div className="feature-card" onClick={() => router.push("/super-admin")}>
              <div className="feature-icon">📋</div>
              <div className="feature-title">Payment History</div>
              <div className="feature-desc">View all payment checks</div>
            </div>
          )}

          {privilege.canExportUsers && (
            <div className="feature-card" onClick={() => router.push("/admin")}>
              <div className="feature-icon">⬇️</div>
              <div className="feature-title">Export Users</div>
              <div className="feature-desc">Download user data</div>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .dashboard-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
          padding-bottom: 40px;
        }

        .page-header {
          background: rgba(30, 41, 59, 0.5);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .header-logo {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
        }

        .user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.25rem;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .user-info h1 {
          color: white;
          font-size: 1.1rem;
          margin: 0 0 4px;
        }

        .role-badge {
          background: rgba(59, 130, 246, 0.3);
          color: #93c5fd;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid rgba(59, 130, 246, 0.5);
        }

        .btn-logout {
          padding: 8px 16px;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 999px;
          color: #fca5a5;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .main-content {
          padding: 20px;
          max-width: 1000px;
          margin: 0 auto;
        }

        .page-title {
          color: white;
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 8px;
          text-align: center;
        }

        .page-subtitle {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.95rem;
          margin: 0 0 32px;
          text-align: center;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }

        .feature-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }

        .feature-icon {
          font-size: 3rem;
          margin-bottom: 12px;
        }

        .feature-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 6px;
        }

        .feature-desc {
          font-size: 0.9rem;
          color: #64748b;
        }
      `}</style>
    </div>
  );
}
