"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";

type MenuItem = {
  id: string;
  label: string;
  icon: string;
  privilegeKey?: string;
  subItems?: MenuItem[];
};

type SidebarLayoutProps = {
  user: any;
  privilege?: any;
  activeSection: string;
  onSectionChange: (section: string) => void;
  children: ReactNode;
  currentTime?: string;
  countdown?: string;
};

export default function SidebarLayout({
  user,
  privilege,
  activeSection,
  onSectionChange,
  children,
  currentTime,
  countdown,
}: SidebarLayoutProps) {
  const router = useRouter();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["payments", "users", "scheduling"]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Checker role sees only Check Payment and Check E-Visa (no Dashboard, no other sections)
  const isCheckerOnly = user?.role === "CHECKER";
  const menuItems: MenuItem[] = isCheckerOnly
    ? [
        { id: "check-payment", label: "Check Payment", icon: "💳", privilegeKey: "canCheckPayment" },
        { id: "check-evisa", label: "Check E-Visa", icon: "📄", privilegeKey: "canCheckEVisa" },
      ]
    : [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "🏠",
    },
    {
      id: "payments",
      label: "Payments & Visa",
      icon: "💳",
      subItems: [
        { id: "check-payment", label: "Check Payment", icon: "💳", privilegeKey: "canCheckPayment" },
        { id: "check-evisa", label: "Check E-Visa", icon: "📄", privilegeKey: "canCheckEVisa" },
        { id: "payment-history", label: "Payment History", icon: "📊", privilegeKey: "canViewPaymentHistory" },
      ],
    },
    {
      id: "users",
      label: "Users & Access",
      icon: "👥",
      subItems: [
        { id: "users-list", label: "User Management", icon: "👥", privilegeKey: "canCreateUser" },
        { id: "reset-passwords", label: "Reset Passwords", icon: "🔑", privilegeKey: "canResetPassword" },
        { id: "privileges", label: "Manage Privileges", icon: "🔐", privilegeKey: "canManagePrivileges" },
        { id: "role-policies", label: "Role Policies", icon: "✅", privilegeKey: "canManageRoles" },
        { id: "export-users", label: "Export Users", icon: "⬇️", privilegeKey: "canExportUsers" },
      ],
    },
    {
      id: "scheduling",
      label: "Scheduling",
      icon: "📅",
      subItems: [
        { id: "schedules", label: "Manage Schedules", icon: "📅", privilegeKey: "canManageSchedules" },
        { id: "patterns", label: "Manage Patterns", icon: "🔄", privilegeKey: "canManagePatterns" },
        { id: "vacations", label: "Approve Vacations", icon: "🏖️", privilegeKey: "canApproveVacations" },
        { id: "settings", label: "Settings", icon: "⚙️", privilegeKey: "canManageSettings" },
      ],
    },
    {
      id: "reporting",
      label: "Reporting",
      icon: "📑",
      subItems: [
        { id: "reports", label: "View Reports", icon: "📊", privilegeKey: "canViewReports" },
        { id: "audit-logs", label: "Audit Logs", icon: "📑", privilegeKey: "canViewAuditLogs" },
      ],
    },
  ];

  const hasAccess = (item: MenuItem): boolean => {
    if (user?.role === "SUPER_ADMIN") return true;
    if (!item.privilegeKey) return true;
    return !!privilege?.[item.privilegeKey];
  };

  const toggleMenu = (id: string) => {
    setExpandedMenus((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const logout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="logo">🛫</div>
          {!sidebarCollapsed && <div className="logo-text">Immigration</div>}
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = expandedMenus.includes(item.id);
            const visibleSubItems = item.subItems?.filter(hasAccess) || [];

            // Hide parent if no subitems are accessible
            if (hasSubItems && visibleSubItems.length === 0 && user?.role !== "SUPER_ADMIN") {
              return null;
            }

            return (
              <div key={item.id} className="nav-group">
                <button
                  className={`nav-item ${activeSection === item.id ? "active" : ""} ${hasSubItems ? "has-sub" : ""}`}
                  onClick={() => {
                    if (hasSubItems) {
                      toggleMenu(item.id);
                    } else {
                      onSectionChange(item.id);
                    }
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="nav-label">{item.label}</span>
                      {hasSubItems && (
                        <span className="nav-arrow">{isExpanded ? "▼" : "▶"}</span>
                      )}
                    </>
                  )}
                </button>

                {hasSubItems && isExpanded && !sidebarCollapsed && (
                  <div className="sub-menu">
                    {visibleSubItems.map((subItem) => (
                      <button
                        key={subItem.id}
                        className={`sub-item ${activeSection === subItem.id ? "active" : ""}`}
                        onClick={() => onSectionChange(subItem.id)}
                      >
                        <span className="sub-icon">{subItem.icon}</span>
                        <span className="sub-label">{subItem.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!sidebarCollapsed && currentTime && (
            <div className="time-display">
              <div className="time-label">MOGADISHU TIME</div>
              <div className="time-value">{currentTime}</div>
            </div>
          )}
          <button className="logout-btn" onClick={logout}>
            <span>🚪</span>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-area">
        <header className="top-bar">
          <button className="toggle-sidebar" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            ☰
          </button>
          <div className="user-info-bar">
            <span className="welcome-text">Welcome back, {user?.fullName}</span>
            <span className="role-badge-top">{user?.role}</span>
          </div>
          {countdown && (
            <div className="countdown-badge">
              <span className="countdown-label">AUTO-SCHEDULE IN</span>
              <span className="countdown-value">{countdown}</span>
            </div>
          )}
        </header>

        <main className="content-area">{children}</main>
      </div>

      <style jsx>{`
        .layout {
          display: flex;
          min-height: 100vh;
          background: #f3f4f6;
        }

        .sidebar {
          width: 280px;
          background: linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%);
          color: white;
          display: flex;
          flex-direction: column;
          transition: width 0.3s ease;
          box-shadow: 4px 0 12px rgba(0, 0, 0, 0.1);
        }

        .sidebar.collapsed {
          width: 70px;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .logo {
          font-size: 2rem;
        }

        .logo-text {
          font-size: 1.2rem;
          font-weight: 700;
        }

        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 12px 0;
        }

        .nav-group {
          margin-bottom: 4px;
        }

        .nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          font-weight: 600;
          text-align: left;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .nav-item.active {
          background: rgba(255, 255, 255, 0.15);
          color: white;
          border-left: 4px solid #22c55e;
        }

        .nav-icon {
          font-size: 1.3rem;
          flex-shrink: 0;
        }

        .nav-label {
          flex: 1;
        }

        .nav-arrow {
          font-size: 0.7rem;
        }

        .sub-menu {
          padding-left: 20px;
        }

        .sub-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
          text-align: left;
        }

        .sub-item:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .sub-item.active {
          background: rgba(255, 255, 255, 0.12);
          color: white;
          border-left: 3px solid #22c55e;
        }

        .sub-icon {
          font-size: 1.1rem;
        }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .time-display {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
          text-align: center;
        }

        .time-label {
          font-size: 10px;
          opacity: 0.7;
          margin-bottom: 4px;
        }

        .time-value {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          color: #fca5a5;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .top-bar {
          background: white;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .toggle-sidebar {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #1e293b;
        }

        .user-info-bar {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .welcome-text {
          font-weight: 600;
          color: #1e293b;
        }

        .role-badge-top {
          padding: 4px 12px;
          background: #dbeafe;
          color: #1e40af;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }

        .countdown-badge {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          padding: 8px 16px;
          border-radius: 12px;
          color: white;
        }

        .countdown-label {
          font-size: 10px;
          opacity: 0.9;
        }

        .countdown-value {
          font-size: 1.2rem;
          font-weight: 700;
        }

        .content-area {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .sidebar:not(.collapsed) {
            position: fixed;
            inset: 0;
            z-index: 1000;
          }
        }
      `}</style>
    </div>
  );
}
