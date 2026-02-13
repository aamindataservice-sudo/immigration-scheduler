"use client";

import { ReactNode, useState, useEffect } from "react";
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
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["payments", "users", "scheduling", "reporting"]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setMobileMenuOpen(false);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Super Admin: only working sections (no check-payment, check-evisa, scheduling, or view-reports)
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isCheckerOnly = user?.role === "CHECKER";

  const superAdminMenuItems: MenuItem[] = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "users-list", label: "User Management", icon: "👥" },
    { id: "payment-history", label: "Payment History", icon: "💳" },
    { id: "privileges", label: "Privileges", icon: "🔐" },
    { id: "role-policies", label: "Role Policies", icon: "✅" },
    { id: "audit-logs", label: "Audit Logs", icon: "📑" },
  ];

  const checkerMenuItems: MenuItem[] = [
    { id: "check-payment", label: "Check Payment", icon: "💳", privilegeKey: "canCheckPayment" },
    { id: "check-evisa", label: "Check E-Visa", icon: "📄", privilegeKey: "canCheckEVisa" },
  ];

  const adminMenuItems: MenuItem[] = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
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
        { id: "privileges", label: "Privileges", icon: "🔐", privilegeKey: "canManagePrivileges" },
        { id: "role-policies", label: "Role Policies", icon: "✅", privilegeKey: "canManageRoles" },
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
        { id: "audit-logs", label: "Audit Logs", icon: "📑", privilegeKey: "canViewAuditLogs" },
      ],
    },
  ];

  const menuItems: MenuItem[] = isSuperAdmin
    ? superAdminMenuItems
    : isCheckerOnly
    ? checkerMenuItems
    : adminMenuItems;

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

  const handleSectionChange = (id: string) => {
    onSectionChange(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="layout">
      {/* Mobile overlay */}
      <div
        className={`sidebar-backdrop ${mobileMenuOpen ? "open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <img src="/logo.svg" alt="" className="logo-img" />
          {!sidebarCollapsed && <div className="logo-text">Arrival</div>}
          <button
            type="button"
            className="sidebar-close-mobile"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
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
                  type="button"
                  className={`nav-item ${activeSection === item.id ? "active" : ""} ${hasSubItems ? "has-sub" : ""}`}
                  onClick={() => {
                    if (hasSubItems) {
                      toggleMenu(item.id);
                    } else {
                      handleSectionChange(item.id);
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
                        type="button"
                        className={`sub-item ${activeSection === subItem.id ? "active" : ""}`}
                        onClick={() => handleSectionChange(subItem.id)}
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
          <button type="button" className="logout-btn" onClick={logout}>
            <span>🚪</span>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-area">
        <header className="top-bar">
          <button
            type="button"
            className="toggle-sidebar"
            onClick={() => (window.innerWidth <= 768 ? setMobileMenuOpen(true) : setSidebarCollapsed(!sidebarCollapsed))}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <img src="/logo.svg" alt="" className="top-bar-logo" />
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
          background: #0f172a;
        }

        .sidebar-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
          opacity: 0;
          transition: opacity 0.25s ease;
          pointer-events: none;
        }
        .sidebar-backdrop.open {
          display: block;
          opacity: 1;
          pointer-events: auto;
        }

        .sidebar {
          width: 280px;
          min-width: 280px;
          background: linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%);
          color: white;
          display: flex;
          flex-direction: column;
          transition: width 0.3s ease, transform 0.3s ease;
          box-shadow: 4px 0 24px rgba(0, 0, 0, 0.2);
          border-right: 1px solid rgba(255, 255, 255, 0.06);
        }

        .sidebar.collapsed {
          width: 72px;
          min-width: 72px;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        .sidebar-close-mobile {
          display: none;
          margin-left: auto;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
          align-items: center;
          justify-content: center;
        }

        .logo-img {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
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
          background: rgba(56, 189, 248, 0.15);
          color: white;
          border-left: 4px solid #38bdf8;
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
          background: rgba(56, 189, 248, 0.12);
          color: white;
          border-left: 3px solid #38bdf8;
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
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(12px);
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .toggle-sidebar {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 1.25rem;
          cursor: pointer;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .top-bar-logo {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
        }

        .toggle-sidebar:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .user-info-bar {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .welcome-text {
          font-weight: 600;
          color: white;
          font-size: 0.95rem;
        }

        .role-badge-top {
          padding: 6px 14px;
          background: rgba(56, 189, 248, 0.2);
          color: #7dd3fc;
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
          padding: 20px;
          overflow-y: auto;
          max-width: 100%;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 1000;
            transform: translateX(-100%);
            width: 280px !important;
            min-width: 280px !important;
          }
          .sidebar.mobile-open {
            transform: translateX(0);
          }
          .sidebar.collapsed {
            width: 280px !important;
            min-width: 280px !important;
          }
          .sidebar-close-mobile {
            display: flex;
          }
          .top-bar {
            padding: 12px 16px;
          }
          .welcome-text {
            font-size: 0.9rem;
          }
          .content-area {
            padding: 16px;
          }
        }

        @media (max-width: 480px) {
          .user-info-bar {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
