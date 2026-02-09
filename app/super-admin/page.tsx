"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";

type User = {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};
type RolePolicy = {
  role: string;
  isAllowed: boolean;
  allowUpdate: boolean;
  allowDeactivate: boolean;
  allowDelete: boolean;
  allowPasswordReset: boolean;
};

type PaymentCheck = {
  id: string;
  type: "PAYMENT_RECEIPT" | "EVISA";
  serialNumber?: string;
  passportNumber?: string;
  referenceNumber?: string;
  visaYear?: string;
  visaMonth?: string;
  status: "FOUND" | "NOT_FOUND" | "ERROR";
  resultUrl?: string;
  createdAt: string;
  checkedByUser: {
    id: string;
    fullName: string;
    phone: string;
    role: string;
  };
};

export default function SuperAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "users-list" | "payment-history" | "privileges" | "role-policies" | "audit-logs">("dashboard");
  const [currentTime, setCurrentTime] = useState("--:-- --");
  const [users, setUsers] = useState<User[]>([]);
  const [paymentChecks, setPaymentChecks] = useState<PaymentCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [rolePolicies, setRolePolicies] = useState<RolePolicy[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [privileges, setPrivileges] = useState<Record<string, any>>({});
  const [selectedPrivilegeUser, setSelectedPrivilegeUser] = useState<string>("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "CHECKER" | "OFFICER">("ALL");
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [compactView, setCompactView] = useState(false);
  const [showErrorChecks, setShowErrorChecks] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditRoleFilter, setAuditRoleFilter] = useState<"ALL" | "SUPER_ADMIN" | "ADMIN" | "CHECKER" | "OFFICER">("ALL");
  
  // Create user form
  const [showCreateChecker, setShowCreateChecker] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("252");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"CHECKER" | "ADMIN" | "OFFICER">("CHECKER");
  
  // Payment checker state
  const [serialNumber, setSerialNumber] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [visaYear, setVisaYear] = useState("2025");
  const [visaMonth, setVisaMonth] = useState("Jan");
  
  // Scheduling state (admin features)
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [shifts, setShifts] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [vacations, setVacations] = useState<any[]>([]);
  const [autoTime, setAutoTime] = useState("19:00");
  const [countdown, setCountdown] = useState("--:--:--");
  
  // Officer features
  const [myShifts, setMyShifts] = useState<any[]>([]);
  
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
    if (parsed.role !== "SUPER_ADMIN") {
      // Redirect to appropriate dashboard
      if (parsed.role === "ADMIN") {
        router.push("/admin");
      } else if (parsed.role === "CHECKER") {
        router.push("/workspace");
      } else {
        router.push("/officer");
      }
      return;
    }
    setUser(parsed);
  }, [router]);
  
  const loadUsers = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/users/list?requesterId=${user.id}`);
      const data = await res.json();
      if (data.ok) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };
  
  const loadPaymentChecks = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/payment/history?userId=${user.id}`);
      const data = await res.json();
      if (data.ok) {
        setPaymentChecks(data.checks);
      }
    } catch (err) {
      console.error("Failed to load payment checks:", err);
    }
  };

  const loadRolePolicies = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/admin/role-policy?requesterId=${user.id}`);
      const data = await res.json();
      if (data.ok) {
        setRolePolicies(data.policies || []);
      }
    } catch (err) {
      console.error("Failed to load role policies:", err);
    }
  };

  const loadAuditLogs = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/audit/logs?requesterId=${user.id}&limit=200`);
      const data = await res.json();
      if (data.ok) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    }
  };

  const loadPrivileges = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/admin/privileges?requesterId=${user.id}`);
      const data = await res.json();
      if (data.ok) {
        const map: Record<string, any> = {};
        (data.privileges || []).forEach((p: any) => {
          map[p.userId] = p;
        });
        setPrivileges(map);
        if (!selectedPrivilegeUser && data.users?.length) {
          setSelectedPrivilegeUser(data.users[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load privileges:", err);
    }
  };

  const initPrivilegesForAll = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/init-privileges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: user?.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`✅ ${data.message}`);
        await loadPrivileges();
      } else {
        setMessage("❌ " + (data.error || "Failed"));
      }
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Failed"));
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (user?.id) {
      loadUsers();
      loadPaymentChecks();
      loadRolePolicies();
      loadAuditLogs();
      loadPrivileges();
    }
  }, [user]);
  
  const createChecker = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    
    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newFullName,
          phone: newPhone,
          password: newPassword || "checker123",
          role: newRole,
          requesterId: user?.id,
        }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setMessage("✅ User created successfully");
        setShowCreateChecker(false);
        setNewFullName("");
        setNewPhone("252");
        setNewPassword("");
        setNewRole("CHECKER");
        loadUsers();
      } else {
        setMessage(`❌ ${data.error || "Failed to create checker"}`);
      }
    } catch (err: any) {
      setMessage(`❌ ${err?.message || "Error creating checker"}`);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    setMessage("");
    try {
      const res = await fetch("/api/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          requesterId: user?.id,
          isActive: !currentStatus,
        }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setMessage(`✅ User ${!currentStatus ? "activated" : "deactivated"}`);
        loadUsers();
      } else {
        setMessage(`❌ ${data.error || "Failed to update user"}`);
      }
    } catch (err: any) {
      setMessage(`❌ ${err?.message || "Error updating user"}`);
    }
  };

  const changeUserRole = async (userId: string, nextRole: string) => {
    setMessage("");
    try {
      const res = await fetch("/api/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: nextRole, requesterId: user?.id }),
      });
      const data = await res.json();
      setMessage(data.ok ? "✅ Role updated" : "❌ " + (data.error || "Failed"));
      if (data.ok) loadUsers();
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Failed"));
    }
  };

  const resetUserPassword = async (userId: string) => {
    setMessage("");
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, requesterId: user?.id }),
      });
      const data = await res.json();
      setMessage(data.ok ? "✅ Password reset (default applied)" : "❌ " + (data.error || "Failed"));
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Failed"));
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user?")) return;
    setMessage("");
    try {
      const res = await fetch("/api/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, requesterId: user?.id }),
      });
      const data = await res.json();
      setMessage(data.ok ? "🗑️ User deleted" : "❌ " + (data.error || "Failed"));
      if (data.ok) loadUsers();
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Failed"));
    }
  };

  const exportUsers = () => {
    if (!user?.id) return;
    window.open(`/api/users/export?requesterId=${user.id}`, "_blank");
  };

  const bulkActivate = async (activate: boolean) => {
    if (!selectedUsers.length) return setMessage("⚠️ Select users first.");
    setMessage("");
    setLoading(true);
    try {
      const tasks = selectedUsers.map((id) =>
        fetch("/api/users/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, isActive: activate, requesterId: user?.id }),
        }).then((r) => r.json())
      );
      const res = await Promise.all(tasks);
      const ok = res.filter((r) => r.ok).length;
      setMessage(`✅ ${activate ? "Activated" : "Deactivated"} ${ok}/${selectedUsers.length}`);
      loadUsers();
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Bulk update failed"));
    } finally {
      setLoading(false);
    }
  };

  const bulkResetPasswords = async () => {
    if (!selectedUsers.length) return setMessage("⚠️ Select users first.");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedUsers, requesterId: user?.id }),
      });
      const data = await res.json();
      setMessage(data.ok ? `✅ Passwords reset for ${data.count}` : "❌ " + (data.error || "Failed"));
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Bulk reset failed"));
    } finally {
      setLoading(false);
    }
  };

  const bulkSetRole = async (role: "OFFICER" | "CHECKER") => {
    if (!selectedUsers.length) return setMessage("⚠️ Select users first.");
    setMessage("");
    setLoading(true);
    try {
      const tasks = selectedUsers.map((id) =>
        fetch("/api/users/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, role, requesterId: user?.id }),
        }).then((r) => r.json())
      );
      const res = await Promise.all(tasks);
      const ok = res.filter((r) => r.ok).length;
      setMessage(`✅ Role set to ${role} for ${ok}/${selectedUsers.length}`);
      loadUsers();
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Bulk role update failed"));
    } finally {
      setLoading(false);
    }
  };

  const applyPrivilegeTemplate = async (userId: string, template: "checker" | "adminHelper" | "readOnly") => {
    const templates: Record<string, any> = {
      checker: {
        canCheckPayment: true,
        canCheckEVisa: true,
        canScanMe: true,
        canDownloadReceipt: true,
        canViewPaymentHistory: false,
        canCreateUser: false,
        canUpdateUser: false,
        canDeleteUser: false,
        canResetPassword: false,
        canManageRoles: false,
        canManagePrivileges: false,
        canViewAuditLogs: false,
        canExportUsers: false,
        canManageSchedules: false,
        canManagePatterns: false,
        canApproveVacations: false,
        canManageSettings: false,
        canViewReports: false,
      },
      adminHelper: {
        canCheckPayment: true,
        canCheckEVisa: true,
        canScanMe: true,
        canDownloadReceipt: true,
        canViewPaymentHistory: true,
        canCreateUser: true,
        canUpdateUser: true,
        canDeleteUser: false,
        canResetPassword: true,
        canManageRoles: false,
        canManagePrivileges: false,
        canViewAuditLogs: true,
        canExportUsers: true,
        canManageSchedules: true,
        canManagePatterns: true,
        canApproveVacations: true,
        canManageSettings: true,
        canViewReports: true,
      },
      readOnly: {
        canCheckPayment: false,
        canCheckEVisa: false,
        canDownloadReceipt: false,
        canViewPaymentHistory: true,
        canCreateUser: false,
        canUpdateUser: false,
        canDeleteUser: false,
        canResetPassword: false,
        canManageRoles: false,
        canManagePrivileges: false,
        canViewAuditLogs: true,
        canExportUsers: false,
        canManageSchedules: false,
        canManagePatterns: false,
        canApproveVacations: false,
        canManageSettings: false,
        canViewReports: true,
      },
    };
    const updates = templates[template];
    if (!updates) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/privileges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: user?.id, userId, privileges: updates }),
      });
      const data = await res.json();
      if (data.ok) {
        setPrivileges((prev) => ({
          ...prev,
          [userId]: { ...(prev[userId] || {}), ...data.privilege },
        }));
        setMessage("✅ Template applied");
      } else {
        setMessage("❌ " + (data.error || "Failed"));
      }
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Failed"));
    } finally {
      setLoading(false);
    }
  };

  const exportAuditCsv = () => {
    const header = ["action", "actor", "role", "target", "time"];
    const rows = filteredAuditLogs.map((log) => [
      log.action,
      log.actor?.fullName || "",
      log.actor?.role || "",
      log.targetType ? `${log.targetType}:${log.targetId || ""}` : "",
      new Date(log.createdAt).toISOString(),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit_logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  
  useEffect(() => {
    const updateTime = () => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Mogadishu",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).formatToParts(new Date());
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      setCurrentTime(`${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const logout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };
  
  const checkerUsers = users.filter(u => u.role === "CHECKER");
  const otherUsers = users.filter(u => u.role !== "CHECKER");
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search);
    const matchesRole = roleFilter === "ALL" ? true : u.role === roleFilter;
    const matchesActive = showInactiveOnly ? !u.isActive : true;
    return matchesSearch && matchesRole && matchesActive;
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
    admins: users.filter((u) => u.role === "ADMIN").length,
    checkers: users.filter((u) => u.role === "CHECKER").length,
    officers: users.filter((u) => u.role === "OFFICER").length,
  };

  const roleDefaults = (role: string) => ({
    canCheckPayment: role === "SUPER_ADMIN" || role === "CHECKER",
    canCheckEVisa: role === "SUPER_ADMIN" || role === "CHECKER",
    canDownloadReceipt: role === "SUPER_ADMIN" || role === "CHECKER",
    canViewPaymentHistory: role === "SUPER_ADMIN",
    canCreateUser: role === "SUPER_ADMIN",
    canUpdateUser: role === "SUPER_ADMIN",
    canDeleteUser: role === "SUPER_ADMIN",
    canResetPassword: role === "SUPER_ADMIN",
    canManageRoles: role === "SUPER_ADMIN",
    canManagePrivileges: role === "SUPER_ADMIN",
    canViewAuditLogs: role === "SUPER_ADMIN",
    canExportUsers: role === "SUPER_ADMIN",
    canManageSchedules: role === "SUPER_ADMIN" || role === "ADMIN",
    canManagePatterns: role === "SUPER_ADMIN" || role === "ADMIN",
    canApproveVacations: role === "SUPER_ADMIN" || role === "ADMIN",
    canManageSettings: role === "SUPER_ADMIN" || role === "ADMIN",
    canViewReports: role === "SUPER_ADMIN" || role === "ADMIN",
  });

  const paymentStats = {
    total: paymentChecks.length,
    found: paymentChecks.filter((c) => c.status === "FOUND").length,
    notFound: paymentChecks.filter((c) => c.status === "NOT_FOUND").length,
    error: paymentChecks.filter((c) => c.status === "ERROR").length,
  };

  const filteredPaymentChecks = paymentChecks.filter((c) =>
    showErrorChecks ? c.status === "ERROR" : true
  );

  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchSearch =
      !auditSearch ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.actor?.fullName || "").toLowerCase().includes(auditSearch.toLowerCase());
    const matchRole = auditRoleFilter === "ALL" ? true : log.actor?.role === auditRoleFilter;
    return matchSearch && matchRole;
  });
  
  return (
    <SidebarLayout
      user={user}
      privilege={{ canManagePrivileges: true, canManageRoles: true, canViewAuditLogs: true }}
      activeSection={activeTab}
      onSectionChange={(section) => setActiveTab(section as any)}
      currentTime={currentTime}
    >
      {message && (
        <div className="toast" onClick={() => setMessage("")}>
          {message}
        </div>
      )}

      <div className="super-admin-content">
        
        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <div>
            <h2 className="section-title" style={{ color: "white" }}>Dashboard</h2>
            <div className="summary-grid">
              <div className="summary-card glow">
                <div className="summary-title">👥 Users</div>
                <div className="summary-values">
                  <span>{stats.total} total</span>
                  <span>{stats.active} active</span>
                  <span>{stats.inactive} inactive</span>
                </div>
                <div className="summary-pills">
                  <span className="chip">Admins {stats.admins}</span>
                  <span className="chip">Checkers {stats.checkers}</span>
                  <span className="chip">Officers {stats.officers}</span>
                </div>
              </div>
              <div className="summary-card glow">
                <div className="summary-title">💳 Payment Checks</div>
                <div className="summary-values">
                  <span>{paymentStats.total} total</span>
                  <span className="good">{paymentStats.found} found</span>
                  <span className="warn">{paymentStats.notFound} not found</span>
                  <span className="error">{paymentStats.error} errors</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users-list" && (
          <div>
            {/* Create User Button */}
            <div className="section-header">
              <h2>Users</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" onClick={exportUsers}>⬇️ Export CSV</button>
                <button className="btn-create" onClick={() => setShowCreateChecker(true)}>
                  ➕ Create User
                </button>
              </div>
            </div>
            <div className="filters-row">
              <input
                className="input"
                placeholder="Search name or phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="CHECKER">Checker</option>
                <option value="OFFICER">Officer</option>
              </select>
              <label className="filter-check">
                <input
                  type="checkbox"
                  checked={showInactiveOnly}
                  onChange={(e) => setShowInactiveOnly(e.target.checked)}
                />
                <span>Inactive only</span>
              </label>
              <label className="filter-check">
                <input
                  type="checkbox"
                  checked={compactView}
                  onChange={(e) => setCompactView(e.target.checked)}
                />
                <span>Compact view</span>
              </label>
              <div className="stat-chips">
                <span className="chip">Total {stats.total}</span>
                <span className="chip">Active {stats.active}</span>
                <span className="chip">Admins {stats.admins}</span>
                <span className="chip">Checkers {stats.checkers}</span>
                <span className="chip">Officers {stats.officers}</span>
              </div>
            </div>
            <div className="bulk-row">
              <span className="muted">{selectedUsers.length} selected</span>
              <div className="action-buttons">
                <button className="btn-small" onClick={() => bulkActivate(true)}>Activate</button>
                <button className="btn-small" onClick={() => bulkActivate(false)}>Deactivate</button>
                <button className="btn-small" onClick={bulkResetPasswords}>Reset PW</button>
                <button className="btn-small" onClick={() => bulkSetRole("CHECKER")}>Set Checker</button>
                <button className="btn-small" onClick={() => bulkSetRole("OFFICER")}>Set Officer</button>
                <button
                  className="btn-small"
                  onClick={() => {
                    setSelectedUsers(filteredUsers.map((u) => u.id));
                  }}
                >
                  Select All Filtered
                </button>
              </div>
            </div>
            
            {/* Create Checker Modal */}
            {showCreateChecker && (
              <div className="modal-overlay" onClick={() => setShowCreateChecker(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Create New User</h3>
                    <button className="close-btn" onClick={() => setShowCreateChecker(false)}>
                      ✕
                    </button>
                  </div>
                  <form onSubmit={createChecker}>
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        className="input"
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="text"
                        className="input"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="252xxxxxxxxx"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password (optional)</label>
                      <input
                        type="password"
                        className="input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave empty for default password"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <select
                        className="input"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as any)}
                      >
                        <option value="CHECKER">Checker</option>
                        <option value="OFFICER">Officer</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setShowCreateChecker(false)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? "Creating..." : "Create User"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            <div className={`users-card ${compactView ? "compact" : ""}`}>
              {filteredUsers.length === 0 ? (
                <div className="empty-state">
                  <span>👥</span>
                  <span>No users match filters</span>
                  <button className="btn-primary" onClick={() => setShowCreateChecker(true)}>
                    Create User
                  </button>
                </div>
              ) : (
                <div className="users-list">
                  {filteredUsers.map((u) => {
                    const isSelected = selectedUsers.includes(u.id);
                    return (
                      <div key={u.id} className="user-item fade-card">
                        <div className="user-avatar-sm">{u.fullName?.charAt(0)?.toUpperCase() || "?"}</div>
                        <div className="user-details">
                          <div className="user-name">{u.fullName}</div>
                          <div className="user-meta">
                            {u.phone} • {u.role}
                          </div>
                          <label className="filter-check" style={{ marginTop: 6 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                setSelectedUsers((prev) =>
                                  e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                                );
                              }}
                            />
                            <span>Select</span>
                          </label>
                        </div>
                        <div className="user-actions">
                          <span className={`status-badge ${u.isActive ? "active" : "inactive"}`}>
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                          <select
                            className="role-select"
                            value={u.role}
                            onChange={(e) => changeUserRole(u.id, e.target.value)}
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="CHECKER">Checker</option>
                            <option value="OFFICER">Officer</option>
                          </select>
                          <div className="action-buttons">
                            <button className="btn-toggle" onClick={() => toggleUserStatus(u.id, u.isActive)}>
                              {u.isActive ? "Deactivate" : "Activate"}
                            </button>
                            <button className="btn-small" onClick={() => resetUserPassword(u.id)}>
                              🔑 Reset PW
                            </button>
                            <button className="btn-small danger" onClick={() => deleteUser(u.id)}>
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Payment Checks Tab */}
        {activeTab === "payment-history" && (
          <div>
            <div className="section-header">
              <h2>All Payment Checks</h2>
              <label className="filter-check">
                <input
                  type="checkbox"
                  checked={showErrorChecks}
                  onChange={(e) => setShowErrorChecks(e.target.checked)}
                />
                <span>Show errors only</span>
              </label>
            </div>
            
            <div className="checks-card">
              {filteredPaymentChecks.length === 0 ? (
                <div className="empty-state">
                  <span>📭</span>
                  <span>No payment checks yet</span>
                </div>
              ) : (
                <div className="checks-list">
                  {filteredPaymentChecks.map((check) => (
                    <div key={check.id} className="check-item">
                      <div className="check-header">
                        <span className="check-type">
                          {check.type === "PAYMENT_RECEIPT" ? "💳 Payment" : "📄 E-Visa"}
                        </span>
                        <span className={`check-status ${check.status.toLowerCase()}`}>
                          {check.status === "FOUND"
                            ? "✅ Found"
                            : check.status === "ERROR"
                            ? "⚠️ Error"
                            : "❌ Not Found"}
                        </span>
                      </div>
                      <div className="check-details">
                        {check.type === "PAYMENT_RECEIPT" ? (
                          <div className="check-field">
                            <strong>Serial:</strong> {check.serialNumber}
                          </div>
                        ) : (
                          <>
                            <div className="check-field">
                              <strong>Passport:</strong> {check.passportNumber}
                            </div>
                            <div className="check-field">
                              <strong>Reference:</strong> {check.referenceNumber}
                            </div>
                            <div className="check-field">
                              <strong>Date:</strong> {check.visaMonth} {check.visaYear}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="check-footer">
                        <div className="checker-info">
                          <strong>Checked by:</strong> {check.checkedByUser.fullName} (
                          {check.checkedByUser.role})
                        </div>
                        <div className="check-time">
                          {new Date(check.createdAt).toLocaleString()}
                        </div>
                      </div>
                      {check.resultUrl && (
                        <a
                          href={check.resultUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-view-result"
                        >
                          🔗 View Result
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Privileges Tab */}
        {activeTab === "privileges" && (
          <div>
            <div className="section-header">
              <h2>User Privileges</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" onClick={initPrivilegesForAll}>
                  🔧 Init All Users
                </button>
                <button className="btn-secondary" onClick={loadPrivileges}>🔄 Refresh</button>
              </div>
            </div>

            {/* Officer dashboard permissions: Check Visa, Payment, Scan Me */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Officer dashboard permissions</h3>
              <p className="muted" style={{ marginBottom: 16, fontSize: 13 }}>Control which features appear on each officer&apos;s dashboard.</p>
              <div className="officer-priv-table-wrap">
                <table className="officer-priv-table">
                  <thead>
                    <tr>
                      <th>Officer</th>
                      <th><label className="officer-priv-check-label"><span>Check Visa</span></label></th>
                      <th><label className="officer-priv-check-label"><span>Payment</span></label></th>
                      <th><label className="officer-priv-check-label"><span>Scan Me</span></label></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter((u) => u.role === "OFFICER").map((officer) => {
                      const priv = privileges[officer.id] || {};
                      const toggleOfficerPriv = async (key: string, current: boolean) => {
                        setLoading(true);
                        try {
                          const res = await fetch("/api/admin/privileges", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              requesterId: user?.id,
                              userId: officer.id,
                              privileges: { [key]: !current },
                            }),
                          });
                          const data = await res.json();
                          if (data.ok) {
                            setPrivileges((prev) => ({
                              ...prev,
                              [officer.id]: { ...(prev[officer.id] || {}), ...data.privilege },
                            }));
                            setMessage("✅ Updated");
                          } else setMessage("❌ " + (data.error || "Failed"));
                        } catch (err: any) {
                          setMessage("❌ " + (err?.message || "Failed"));
                        } finally {
                          setLoading(false);
                        }
                      };
                      return (
                        <tr key={officer.id}>
                          <td className="officer-name-cell">{officer.fullName}</td>
                          <td>
                            <label className="officer-priv-check-label">
                              <input
                                type="checkbox"
                                checked={!!priv.canCheckEVisa}
                                onChange={() => toggleOfficerPriv("canCheckEVisa", !!priv.canCheckEVisa)}
                                disabled={loading}
                              />
                              <span className="check-visa">Check Visa</span>
                            </label>
                          </td>
                          <td>
                            <label className="officer-priv-check-label">
                              <input
                                type="checkbox"
                                checked={!!priv.canCheckPayment}
                                onChange={() => toggleOfficerPriv("canCheckPayment", !!priv.canCheckPayment)}
                                disabled={loading}
                              />
                              <span className="check-payment">Payment</span>
                            </label>
                          </td>
                          <td>
                            <label className="officer-priv-check-label">
                              <input
                                type="checkbox"
                                checked={!!(priv.canScanMe !== false)}
                                onChange={() => toggleOfficerPriv("canScanMe", !!(priv.canScanMe !== false))}
                                disabled={loading}
                              />
                              <span className="scan-me">Scan Me</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {users.filter((u) => u.role === "OFFICER").length === 0 && (
                <p className="muted" style={{ margin: 12, fontSize: 13 }}>No officers yet. Create users with role OFFICER.</p>
              )}
            </div>

            <div className="card">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Select User</label>
                  <select
                    className="input"
                    value={selectedPrivilegeUser}
                    onChange={(e) => setSelectedPrivilegeUser(e.target.value)}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedPrivilegeUser && (
                <>
                  <div className="template-row">
                    <span className="muted label">Templates:</span>
                    <div className="action-buttons">
                      <button className="btn-small" onClick={() => applyPrivilegeTemplate(selectedPrivilegeUser, "checker")}>
                        Checker Core
                      </button>
                      <button className="btn-small" onClick={() => applyPrivilegeTemplate(selectedPrivilegeUser, "adminHelper")}>
                        Admin Helper
                      </button>
                      <button className="btn-small" onClick={() => applyPrivilegeTemplate(selectedPrivilegeUser, "readOnly")}>
                        Read Only
                      </button>
                    </div>
                  </div>
                  <div className="label-row">
                    <span className="label">Toggle privileges:</span>
                    <span className="label-muted">Enabled = allowed for this user</span>
                  </div>
                  {[
                    {
                      title: "Payments & Visa",
                      items: [
                        { key: "canCheckPayment", label: "Check Payment" },
                        { key: "canCheckEVisa", label: "Check E-Visa" },
                        { key: "canScanMe", label: "Scan Me" },
                        { key: "canDownloadReceipt", label: "Download Receipt" },
                        { key: "canViewPaymentHistory", label: "View Payment History" },
                      ],
                    },
                    {
                      title: "Users & Access",
                      items: [
                        { key: "canCreateUser", label: "Create User" },
                        { key: "canUpdateUser", label: "Update User" },
                        { key: "canDeleteUser", label: "Delete User" },
                        { key: "canResetPassword", label: "Reset Password" },
                        { key: "canManageRoles", label: "Manage Roles" },
                        { key: "canManagePrivileges", label: "Manage Privileges" },
                        { key: "canExportUsers", label: "Export Users" },
                      ],
                    },
                    {
                      title: "Scheduling",
                      items: [
                        { key: "canManageSchedules", label: "Manage Schedules" },
                        { key: "canManagePatterns", label: "Manage Patterns" },
                        { key: "canApproveVacations", label: "Approve Vacations" },
                        { key: "canManageSettings", label: "Manage Settings" },
                      ],
                    },
                    {
                      title: "Reporting",
                      items: [
                        { key: "canViewReports", label: "View Reports" },
                        { key: "canViewAuditLogs", label: "View Audit Logs" },
                      ],
                    },
                  ].map((group) => {
                    const selectedUser = users.find((u) => u.id === selectedPrivilegeUser);
                    const basePriv = privileges[selectedPrivilegeUser] || (selectedUser ? roleDefaults(selectedUser.role) : {});
                    return (
                      <div key={group.title} className="priv-group">
                        <div className="priv-group-title">{group.title}</div>
                        <div className="priv-grid">
                          {group.items.map((p) => {
                            const checked = !!basePriv[p.key];
                            return (
                              <label key={p.key} className="priv-item">
                                <input
                                  type="checkbox"
                                  aria-label={p.label}
                                  checked={checked}
                                  onChange={async () => {
                                    setLoading(true);
                                    try {
                                      const res = await fetch("/api/admin/privileges", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          requesterId: user?.id,
                                          userId: selectedPrivilegeUser,
                                          privileges: { [p.key]: !checked },
                                        }),
                                      });
                                      const data = await res.json();
                                      if (data.ok) {
                                        setPrivileges((prev) => ({
                                          ...prev,
                                          [selectedPrivilegeUser]: {
                                            ...(prev[selectedPrivilegeUser] || {}),
                                            ...data.privilege,
                                          },
                                        }));
                                        setMessage("✅ Privilege updated");
                                      } else {
                                        setMessage("❌ " + (data.error || "Failed to update"));
                                      }
                                    } catch (err: any) {
                                      setMessage("❌ " + (err?.message || "Failed to update"));
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                />
                                <span>{p.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* Role Policies Tab */}
        {activeTab === "role-policies" && (
          <div>
            <div className="section-header">
              <h2>Role Creation Policy</h2>
              <button className="btn-secondary" onClick={loadRolePolicies}>
                🔄 Refresh
              </button>
            </div>
            <div className="card">
              <p className="muted">Control what non–Super Admins can do per role.</p>
              <div className="label-row">
                <span className="label">Labels:</span>
                <span className="label-muted">Checks apply to actions performed by non–Super Admin users.</span>
              </div>
              <div className="policy-table">
                <div className="policy-header">
                  <span>Role</span>
                  <span>Create</span>
                  <span>Update</span>
                  <span>Activate/Deactivate</span>
                  <span>Delete</span>
                  <span>Reset PW</span>
                </div>
                {["ADMIN", "CHECKER", "OFFICER"].map((role) => {
                  const policy = rolePolicies.find((p) => p.role === role) || {
                    role,
                    isAllowed: true,
                    allowUpdate: true,
                    allowDeactivate: true,
                    allowDelete: false,
                    allowPasswordReset: true,
                  };
                  const toggle = async (field: keyof RolePolicy) => {
                    setLoading(true);
                    try {
                      await fetch("/api/admin/role-policy", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          requesterId: user?.id,
                          policies: [{ role, [field]: !policy[field] }],
                        }),
                      });
                      await loadRolePolicies();
                      setMessage("✅ Policy updated");
                    } catch (err: any) {
                      setMessage("❌ " + (err?.message || "Failed to update"));
                    } finally {
                      setLoading(false);
                    }
                  };
                  return (
                    <div key={role} className="policy-row">
                      <span>{role}</span>
                      <label className="policy-toggle">
                        <input aria-label={`${role} create`} type="checkbox" checked={policy.isAllowed} onChange={() => toggle("isAllowed")} />
                        <span>Create</span>
                      </label>
                      <label className="policy-toggle">
                        <input aria-label={`${role} update`} type="checkbox" checked={policy.allowUpdate} onChange={() => toggle("allowUpdate")} />
                        <span>Update</span>
                      </label>
                      <label className="policy-toggle">
                        <input aria-label={`${role} activate/deactivate`} type="checkbox" checked={policy.allowDeactivate} onChange={() => toggle("allowDeactivate")} />
                        <span>Activate</span>
                      </label>
                      <label className="policy-toggle">
                        <input aria-label={`${role} delete`} type="checkbox" checked={policy.allowDelete} onChange={() => toggle("allowDelete")} />
                        <span>Delete</span>
                      </label>
                      <label className="policy-toggle">
                        <input aria-label={`${role} reset password`} type="checkbox" checked={policy.allowPasswordReset} onChange={() => toggle("allowPasswordReset")} />
                        <span>Reset PW</span>
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="muted" style={{ marginTop: 12 }}>
                Note: Only Super Admin can create/delete Super Admin accounts (always restricted).
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "audit-logs" && (
          <div>
            <div className="section-header">
              <h2>Activity Logs</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" onClick={loadAuditLogs}>
                  🔄 Refresh
                </button>
                <button className="btn-secondary" onClick={exportAuditCsv}>
                  ⬇️ Export CSV
                </button>
              </div>
            </div>
            <div className="filters-row">
              <input
                className="input"
                placeholder="Search action or actor"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
              <select
                className="input"
                value={auditRoleFilter}
                onChange={(e) => setAuditRoleFilter(e.target.value as any)}
              >
                <option value="ALL">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Admin</option>
                <option value="CHECKER">Checker</option>
                <option value="OFFICER">Officer</option>
              </select>
            </div>
            <div className="card">
              {filteredAuditLogs.length === 0 ? (
                <div className="empty-state">
                  <span>📭</span>
                  <span>No activity recorded yet</span>
                </div>
              ) : (
                <div className="log-table">
                  <div className="log-header">
                    <span>Action</span>
                    <span>Actor</span>
                    <span>Target</span>
                    <span>Time</span>
                  </div>
                  {filteredAuditLogs.map((log) => (
                    <div key={log.id} className="log-row">
                      <span>{log.action}</span>
                      <span>
                        {log.actor?.fullName || "—"} ({log.actor?.role || "N/A"})
                      </span>
                      <span>{log.targetType ? `${log.targetType} ${log.targetId || ""}` : "—"}</span>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      <style jsx>{`
        .super-admin-content {
          width: 100%;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }
        
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 1.25rem;
          box-shadow: 0 10px 30px rgba(245, 158, 11, 0.35);
        }
        
        .user-info h1 {
          color: white;
          font-size: 1.1rem;
          margin: 0 0 4px;
        }
        
        .role-badge {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .btn-logout {
          padding: 10px 18px;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.3);
        }
        
        .toast {
          position: fixed;
          top: 16px;
          right: 16px;
          padding: 8px 12px;
          background: rgba(26, 54, 93, 0.92);
          color: white;
          border-radius: 8px;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25);
          z-index: 120;
          cursor: pointer;
          max-width: 280px;
          font-size: 12.5px;
          line-height: 1.3;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .summary-card {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 14px 16px;
          color: #e2e8f0;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
          position: relative;
          overflow: hidden;
        }

        .glow::after {
          content: "";
          position: absolute;
          inset: -40%;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.18), transparent 55%);
          animation: floatGlow 8s ease-in-out infinite alternate;
          pointer-events: none;
        }

        @keyframes floatGlow {
          from { transform: translateX(-10%) translateY(-5%); }
          to { transform: translateX(6%) translateY(4%); }
        }

        .summary-title {
          font-weight: 800;
          margin-bottom: 6px;
          position: relative;
          z-index: 1;
        }

        .summary-values {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          font-weight: 700;
          position: relative;
          z-index: 1;
        }

        .summary-values .good { color: #bbf7d0; }
        .summary-values .warn { color: #fde68a; }
        .summary-values .error { color: #fecdd3; }

        .summary-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 6px;
          position: relative;
          z-index: 1;
        }
        
        .main-content {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .tabs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
          margin-bottom: 20px;
          background: rgba(255, 255, 255, 0.08);
          padding: 8px;
          border-radius: 18px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
        }
        
        .tab {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          color: #e2e8f0;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }
        
        .tab.active {
          background: linear-gradient(135deg, #22c55e, #3b82f6);
          color: white;
          border-color: transparent;
          box-shadow: 0 12px 32px rgba(34, 197, 94, 0.35);
          transform: translateY(-2px);
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .section-header h2 {
          color: white;
          font-size: 1.25rem;
          margin: 0;
        }
        
        .btn-create {
          padding: 10px 18px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .btn-create:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(34, 197, 94, 0.4);
        }
        
        .card {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 16px 18px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
          color: #e2e8f0;
          backdrop-filter: blur(8px);
        }

        .users-card,
        .checks-card {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(8px);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .users-card.compact .user-item {
          padding: 10px 12px;
          gap: 10px;
        }

        .users-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.3);
        }
        
        .users-list,
        .checks-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .user-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .user-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
        }
        
        .user-avatar-sm {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 1rem;
          box-shadow: 0 8px 18px rgba(59, 130, 246, 0.35);
        }
        
        .user-details {
          flex: 1;
        }
        
        .user-name {
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 2px;
        }
        
        .user-meta {
          font-size: 12px;
          color: #cbd5e1;
        }
        
        .user-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .status-badge.active {
          background: rgba(22, 101, 52, 0.2);
          color: #bbf7d0;
        }
        
        .status-badge.inactive {
          background: rgba(153, 27, 27, 0.2);
          color: #fecdd3;
        }
        
        .btn-toggle {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          color: #e2e8f0;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .action-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .btn-small {
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: #f8fafc;
          color: #1f2937;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
        }

        .btn-small.danger {
          border-color: #fecaca;
          background: #fff1f2;
          color: #b91c1c;
        }

        .role-select {
          background: #f8fafc;
          color: #1f2937;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .btn-toggle:hover {
          background: #e2e8f0;
        }
        
        .check-item {
          padding: 16px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        
        .check-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .check-type {
          font-weight: 600;
          color: #1e293b;
          font-size: 14px;
        }
        
        .check-status {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .check-status.found {
          background: #dcfce7;
          color: #166534;
        }
        
        .check-status.not_found {
          background: #fee2e2;
          color: #991b1b;
        }
        
        .check-status.error {
          background: #fef3c7;
          color: #92400e;
        }
        
        .check-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 12px;
        }
        
        .check-field {
          font-size: 13px;
          color: #475569;
        }
        
        .check-field strong {
          color: #1e293b;
          margin-right: 4px;
        }
        
        .check-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }
        
        .checker-info {
          font-size: 12px;
          color: #64748b;
        }
        
        .checker-info strong {
          color: #475569;
        }
        
        .check-time {
          font-size: 11px;
          color: #94a3b8;
        }
        
        .btn-view-result {
          display: inline-block;
          margin-top: 12px;
          padding: 8px 14px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .btn-view-result:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        
        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: #64748b;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }
        
        .empty-state span:first-child {
          font-size: 3rem;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 20px;
        }
        
        .modal-content {
          background: white;
          border-radius: 20px;
          width: 100%;
          max-width: 480px;
          padding: 24px;
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .modal-header h3 {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
          color: #1e293b;
        }
        
        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #f1f5f9;
          border: none;
          cursor: pointer;
          font-size: 18px;
          color: #64748b;
        }
        
        .close-btn:hover {
          background: #e2e8f0;
        }
        
        .form-group {
          margin-bottom: 16px;
        }
        
        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
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
        
        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }
        
        .btn-primary {
          flex: 1;
          padding: 12px 20px;
          background: linear-gradient(135deg, #22c55e, #0ea5e9);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 10px 28px rgba(34, 197, 94, 0.35);
        }
        
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
        }
        
        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .btn-secondary {
          flex: 1;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .policies-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .policy-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
        }

        .log-table {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .log-header, .log-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 8px;
          padding: 10px;
          border-radius: 10px;
        }

        .log-header {
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          font-weight: 700;
        }

        .log-row {
          background: rgba(255, 255, 255, 0.04);
          color: white;
          font-size: 14px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .priv-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .priv-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: white;
          font-weight: 600;
        }

        .officer-priv-table-wrap {
          overflow-x: auto;
        }
        .officer-priv-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .officer-priv-table th,
        .officer-priv-table td {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          text-align: left;
        }
        .officer-priv-table th {
          color: #94a3b8;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
        }
        .officer-name-cell {
          color: #e2e8f0;
          font-weight: 500;
        }
        .officer-priv-check-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          color: #cbd5e1;
        }
        .officer-priv-check-label input {
          width: 18px;
          height: 18px;
          accent-color: #22c55e;
        }

        .priv-group {
          margin-top: 12px;
        }

        .priv-group-title {
          font-weight: 800;
          color: #e2e8f0;
          margin-bottom: 6px;
          font-size: 14px;
        }

        .template-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 10px 0;
        }

        .label-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 6px 0 10px;
          flex-wrap: wrap;
        }

        .label {
          font-weight: 700;
          color: #e2e8f0;
        }

        .label-muted {
          color: #cbd5e1;
          font-size: 12px;
        }

        .filters-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin-bottom: 12px;
          align-items: center;
        }

        .bulk-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 10px 0 14px;
        }

        .stat-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .chip {
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          border-radius: 999px;
          font-size: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .policy-table {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .policy-header, .policy-row {
          display: grid;
          grid-template-columns: 1.2fr repeat(5, 1fr);
          gap: 8px;
          padding: 10px;
          border-radius: 10px;
          align-items: center;
        }
        .policy-header {
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          font-weight: 700;
        }
        .policy-row {
          background: rgba(255, 255, 255, 0.04);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .policy-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.06);
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        @media (max-width: 768px) {
          .user-item {
            flex-wrap: wrap;
          }
          
          .user-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
      </div>
    </SidebarLayout>
  );
}
