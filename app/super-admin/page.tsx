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
  const [usersLoading, setUsersLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [rolePolicies, setRolePolicies] = useState<RolePolicy[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [privileges, setPrivileges] = useState<Record<string, any>>({});
  const [selectedPrivilegeUser, setSelectedPrivilegeUser] = useState<string>("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "CHECKER" | "OFFICER">("ALL");
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showErrorChecks, setShowErrorChecks] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditRoleFilter, setAuditRoleFilter] = useState<"ALL" | "SUPER_ADMIN" | "ADMIN" | "CHECKER" | "OFFICER">("ALL");
  const [auditUserFilter, setAuditUserFilter] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [activitySummary, setActivitySummary] = useState<{
    totalActivities: number;
    byAction: Record<string, number>;
    byRole: Record<string, number>;
    topUsers: {
      userId: string;
      fullName: string;
      role: string;
      count: number;
      checkPayment?: number;
      checkEvisa?: number;
      downloadReceipt?: number;
      scanMe?: number;
      login?: number;
      found?: number;
      notFound?: number;
      error?: number;
    }[];
    lastSeen: { userId: string; fullName: string; role: string; lastSeenAt: string }[];
  } | null>(null);

  // Pagination
  const [usersPage, setUsersPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const USERS_PAGE_SIZE = 15;
  const PAYMENT_PAGE_SIZE = 15;
  const AUDIT_PAGE_SIZE = 20;

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
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/users/list?requesterId=${user.id}`);
      const data = await res.json();
      if (data.ok) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setUsersLoading(false);
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
      const params = new URLSearchParams({ requesterId: user.id, limit: "300" });
      if (auditUserFilter) params.set("userId", auditUserFilter);
      if (auditRoleFilter !== "ALL") params.set("role", auditRoleFilter);
      if (auditDateFrom) params.set("dateFrom", auditDateFrom);
      if (auditDateTo) params.set("dateTo", auditDateTo);
      const res = await fetch(`/api/audit/logs?${params}`);
      const data = await res.json();
      if (data.ok) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    }
  };

  const loadActivitySummary = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/audit/summary?requesterId=${user.id}`);
      const data = await res.json();
      if (data.ok) {
        setActivitySummary({
          totalActivities: data.totalActivities ?? 0,
          byAction: data.byAction ?? {},
          byRole: data.byRole ?? {},
          topUsers: data.topUsers ?? [],
          lastSeen: data.lastSeen ?? [],
        });
      }
    } catch (err) {
      console.error("Failed to load activity summary:", err);
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
      loadActivitySummary();
    }
  }, [user]);

  useEffect(() => {
    if (user?.id && activeTab === "audit-logs") {
      loadAuditLogs();
      setAuditPage(1);
    }
  }, [user?.id, activeTab, auditUserFilter, auditRoleFilter, auditDateFrom, auditDateTo]);
  
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

  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const paymentTotalPages = Math.max(1, Math.ceil(filteredPaymentChecks.length / PAYMENT_PAGE_SIZE));
  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditLogs.length / AUDIT_PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice(
    (usersPage - 1) * USERS_PAGE_SIZE,
    usersPage * USERS_PAGE_SIZE
  );
  const paginatedPaymentChecks = filteredPaymentChecks.slice(
    (paymentPage - 1) * PAYMENT_PAGE_SIZE,
    paymentPage * PAYMENT_PAGE_SIZE
  );
  const paginatedAuditLogs = filteredAuditLogs.slice(
    (auditPage - 1) * AUDIT_PAGE_SIZE,
    auditPage * AUDIT_PAGE_SIZE
  );
  
  return (
    <SidebarLayout
      user={user}
      privilege={{ canManagePrivileges: true, canManageRoles: true, canViewAuditLogs: true }}
      activeSection={activeTab}
      onSectionChange={(section) => setActiveTab(section as any)}
      currentTime={currentTime}
    >
      {message && (
        <div className="toast" onClick={() => setMessage("")} role="alert">
          {message}
        </div>
      )}

      <div className="super-admin-content">
        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <div className="sa-dashboard">
            <div className="sa-dashboard-head">
              <h1 className="sa-page-title">Dashboard</h1>
              <p className="sa-page-sub">Overview and quick stats</p>
              <button
                type="button"
                className="sa-refresh-btn"
                onClick={() => user?.id && (loadUsers(), loadPaymentChecks(), loadAuditLogs(), loadPrivileges(), loadRolePolicies(), loadActivitySummary())}
              >
                🔄 Refresh
              </button>
            </div>

            <section className="sa-summary-section">
              <h2 className="sa-summary-heading">Summary</h2>
              <div className="summary-grid summary-grid-responsive">
                <div className="summary-card glow" onClick={() => setActiveTab("users-list")}>
                  <div className="summary-title">👥 Users</div>
                  <div className="summary-values">
                    <span>{stats.total} total</span>
                    <span>{stats.active} active</span>
                    <span>{stats.inactive} inactive</span>
                  </div>
                  <div className="summary-pills">
                    <span className="chip">Admin {stats.admins}</span>
                    <span className="chip">Checker {stats.checkers}</span>
                    <span className="chip">Officer {stats.officers}</span>
                  </div>
                  <span className="summary-link">User Management →</span>
                </div>
                <div className="summary-card glow" onClick={() => setActiveTab("payment-history")}>
                  <div className="summary-title">💳 Payment & E-Visa</div>
                  <div className="summary-values">
                    <span>{paymentStats.total} checks</span>
                    <span className="good">{paymentStats.found} found</span>
                    <span className="warn">{paymentStats.notFound} not found</span>
                    <span className="error">{paymentStats.error} errors</span>
                  </div>
                  <span className="summary-link">Payment History →</span>
                </div>
                <div className="summary-card glow" onClick={() => setActiveTab("audit-logs")}>
                  <div className="summary-title">📊 Activity</div>
                  <div className="summary-values">
                    <span>{activitySummary?.totalActivities ?? auditLogs.length} total actions</span>
                  </div>
                  <div className="summary-pills">
                    {activitySummary && Object.keys(activitySummary.byAction).length > 0 && (
                      Object.entries(activitySummary.byAction).slice(0, 4).map(([k, n]) => (
                        <span key={k} className="chip">{k.replace(/_/g, " ")} {n}</span>
                      ))
                    )}
                  </div>
                  <span className="summary-link">Audit Logs →</span>
                </div>
              </div>
            </section>

            <section className="sa-quick-nav">
              <h2 className="sa-summary-heading">Quick access</h2>
              <div className="sa-quick-nav-grid">
                <button type="button" className="sa-quick-card" onClick={() => setActiveTab("users-list")}>
                  <span className="sa-quick-icon">👥</span>
                  <span className="sa-quick-label">User Management</span>
                  <span className="sa-quick-desc">Create, edit, export users</span>
                </button>
                <button type="button" className="sa-quick-card" onClick={() => setActiveTab("payment-history")}>
                  <span className="sa-quick-icon">💳</span>
                  <span className="sa-quick-label">Payment History</span>
                  <span className="sa-quick-desc">Payment & e-Visa checks</span>
                </button>
                <button type="button" className="sa-quick-card" onClick={() => setActiveTab("privileges")}>
                  <span className="sa-quick-icon">🔐</span>
                  <span className="sa-quick-label">Privileges</span>
                  <span className="sa-quick-desc">Officer permissions</span>
                </button>
                <button type="button" className="sa-quick-card" onClick={() => setActiveTab("role-policies")}>
                  <span className="sa-quick-icon">✅</span>
                  <span className="sa-quick-label">Role Policies</span>
                  <span className="sa-quick-desc">Role capabilities</span>
                </button>
                <button type="button" className="sa-quick-card" onClick={() => setActiveTab("audit-logs")}>
                  <span className="sa-quick-icon">📑</span>
                  <span className="sa-quick-label">Audit Logs</span>
                  <span className="sa-quick-desc">Activity history</span>
                </button>
              </div>
            </section>

            <section className="sa-recent-section">
              <h2 className="sa-summary-heading">Top 10 users by activity</h2>
              <div className="sa-recent-card sa-top10-wrap">
                {!activitySummary ? (
                  <p className="sa-recent-empty">Loading…</p>
                ) : activitySummary.topUsers.length === 0 ? (
                  <p className="sa-recent-empty">No activity yet</p>
                ) : (
                  <div className="sa-top10-table-wrap">
                    <table className="sa-top10-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>User</th>
                          <th>Role</th>
                          <th>Total</th>
                          <th>Payment</th>
                          <th>E-Visa</th>
                          <th>Scan</th>
                          <th>Found</th>
                          <th>Not found</th>
                          <th>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activitySummary.topUsers.map((u, i) => (
                          <tr key={u.userId}>
                            <td>{i + 1}</td>
                            <td className="sa-top10-name">{u.fullName}</td>
                            <td>{u.role}</td>
                            <td><strong>{u.count}</strong></td>
                            <td>{u.checkPayment ?? 0}</td>
                            <td>{u.checkEvisa ?? 0}</td>
                            <td>{u.scanMe ?? 0}</td>
                            <td className="sa-cell-good">{u.found ?? 0}</td>
                            <td className="sa-cell-warn">{u.notFound ?? 0}</td>
                            <td className="sa-cell-error">{u.error ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button type="button" className="sa-recent-more" onClick={() => setActiveTab("audit-logs")}>
                  View all logs →
                </button>
              </div>
            </section>

            <section className="sa-recent-section">
              <h2 className="sa-summary-heading">Last seen</h2>
              <div className="sa-recent-card">
                {!activitySummary ? (
                  <p className="sa-recent-empty">Loading…</p>
                ) : activitySummary.lastSeen.length === 0 ? (
                  <p className="sa-recent-empty">No activity yet</p>
                ) : (
                  <ul className="sa-recent-list">
                    {activitySummary.lastSeen.slice(0, 15).map((u) => (
                      <li key={u.userId} className="sa-recent-item">
                        <span className="sa-recent-actor">{u.fullName}</span>
                        <span className="sa-recent-meta">{u.role}</span>
                        <span className="sa-recent-time">{new Date(u.lastSeenAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="sa-recent-more" onClick={() => setActiveTab("audit-logs")}>
                  View all logs →
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Users Tab - User Management */}
        {activeTab === "users-list" && (
          <div className="sa-section">
            <div className="section-header">
              <h1 className="sa-page-title">User Management</h1>
              <p className="sa-page-sub">Create, edit, and manage users and roles</p>
              <div className="section-actions">
                <button type="button" className="btn-secondary" onClick={() => { loadUsers(); setUsersPage(1); }}>🔄 Refresh</button>
                <button type="button" className="btn-secondary" onClick={exportUsers}>⬇️ Export CSV</button>
                <button type="button" className="btn-create" onClick={() => setShowCreateChecker(true)}>
                  ➕ Create User
                </button>
              </div>
            </div>
            <div className="filters-row">
              <input
                className="input"
                placeholder="Search name or phone"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setUsersPage(1); }}
              />
              <select className="input" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as any); setUsersPage(1); }}>
                <option value="ALL">All roles</option>
                <option value="ADMIN">Admin</option>
                <option value="CHECKER">Checker</option>
                <option value="OFFICER">Officer</option>
              </select>
              <label className="filter-check">
                <input
                  type="checkbox"
                  checked={showInactiveOnly}
                  onChange={(e) => { setShowInactiveOnly(e.target.checked); setUsersPage(1); }}
                />
                <span>Inactive only</span>
              </label>
              <div className="stat-chips">
                <span className="chip">Total {stats.total}</span>
                <span className="chip">Active {stats.active}</span>
                <span className="chip">Admin {stats.admins}</span>
                <span className="chip">Checker {stats.checkers}</span>
                <span className="chip">Officer {stats.officers}</span>
              </div>
            </div>
            <div className="bulk-row">
              <span className="muted">{selectedUsers.length} selected</span>
              <div className="action-buttons">
                <button className="btn-small" onClick={() => bulkActivate(true)}>Activate</button>
                <button className="btn-small" onClick={() => bulkActivate(false)}>Deactivate</button>
                <button className="btn-small" onClick={bulkResetPasswords}>Reset PW</button>
                <button className="btn-small" onClick={() => bulkSetRole("CHECKER")}>Checker</button>
                <button className="btn-small" onClick={() => bulkSetRole("OFFICER")}>Officer</button>
                <button className="btn-small" onClick={() => setSelectedUsers(filteredUsers.map((u) => u.id))}>Select all</button>
              </div>
            </div>

            {showCreateChecker && (
              <div className="modal-overlay" onClick={() => setShowCreateChecker(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Create New User</h3>
                    <button className="close-btn" onClick={() => setShowCreateChecker(false)}>✕</button>
                  </div>
                  <form onSubmit={createChecker}>
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input type="text" className="input" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="Full name" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input type="text" className="input" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="252xxxxxxxxx" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password (optional)</label>
                      <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Default if empty" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as any)}>
                        <option value="CHECKER">Checker</option>
                        <option value="OFFICER">Officer</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                    <div className="modal-actions">
                      <button type="button" className="btn-secondary" onClick={() => setShowCreateChecker(false)}>Cancel</button>
                      <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Creating…" : "Create"}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="users-card users-list-card">
              <div className="users-list-card-head">
                <h3 className="users-list-card-title">Users list</h3>
                <span className="users-list-card-count">{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}</span>
              </div>

              {usersLoading && users.length === 0 ? (
                <div className="empty-state users-loading-state">
                  <span className="loading-spinner">⟳</span>
                  <span>Loading users…</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="empty-state">
                  <span>👥</span>
                  <span>No users match filters</span>
                  <button type="button" className="btn-primary" onClick={() => setShowCreateChecker(true)}>Create User</button>
                </div>
              ) : (
                <>
                  <div className="sa-users-table-wrap">
                    <table className="sa-users-table">
                      <thead>
                        <tr>
                          <th className="sa-users-th-check">
                            <input
                              type="checkbox"
                              checked={paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedUsers.includes(u.id))}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedUsers((prev) => [...new Set([...prev, ...paginatedUsers.map((u) => u.id)])]);
                                else setSelectedUsers((prev) => prev.filter((id) => !paginatedUsers.some((u) => u.id === id)));
                              }}
                              aria-label="Select page"
                            />
                          </th>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedUsers.map((u) => {
                          const isSelected = selectedUsers.includes(u.id);
                          return (
                            <tr key={u.id} className="sa-users-tr">
                              <td className="sa-users-td-check">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => setSelectedUsers((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))}
                                  aria-label={`Select ${u.fullName}`}
                                />
                              </td>
                              <td className="sa-users-name">{u.fullName}</td>
                              <td className="sa-users-td-phone">{u.phone}</td>
                              <td>
                                <select className="role-select-inline" value={u.role} onChange={(e) => changeUserRole(u.id, e.target.value)}>
                                  <option value="ADMIN">Admin</option>
                                  <option value="CHECKER">Checker</option>
                                  <option value="OFFICER">Officer</option>
                                </select>
                              </td>
                              <td>
                                <span className={`status-badge ${u.isActive ? "active" : "inactive"}`}>{u.isActive ? "Active" : "Inactive"}</span>
                              </td>
                              <td className="sa-users-actions">
                                <button type="button" className="btn-small" onClick={() => toggleUserStatus(u.id, u.isActive)}>{u.isActive ? "Deactivate" : "Activate"}</button>
                                <button type="button" className="btn-small" onClick={() => resetUserPassword(u.id)}>Reset PW</button>
                                <button type="button" className="btn-small danger" onClick={() => deleteUser(u.id)}>Delete</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination-bar">
                    <span className="pagination-info">Showing {(usersPage - 1) * USERS_PAGE_SIZE + 1}–{Math.min(usersPage * USERS_PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}</span>
                    <div className="pagination-controls">
                      <button type="button" className="btn-small" disabled={usersPage <= 1} onClick={() => setUsersPage((p) => p - 1)}>← Prev</button>
                      <span className="pagination-page">Page {usersPage} of {usersTotalPages}</span>
                      <button type="button" className="btn-small" disabled={usersPage >= usersTotalPages} onClick={() => setUsersPage((p) => p + 1)}>Next →</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Payment Checks Tab */}
        {activeTab === "payment-history" && (
          <div className="sa-section">
            <div className="section-header">
              <h1 className="sa-page-title">Payment History</h1>
              <p className="sa-page-sub">Payment receipts and e-Visa checks</p>
              <div className="section-actions">
                <button type="button" className="btn-secondary" onClick={() => { loadPaymentChecks(); setPaymentPage(1); }}>🔄 Refresh</button>
                <label className="filter-check">
                  <input type="checkbox" checked={showErrorChecks} onChange={(e) => { setShowErrorChecks(e.target.checked); setPaymentPage(1); }} />
                  <span>Errors only</span>
                </label>
              </div>
            </div>
            <div className="checks-card">
              {filteredPaymentChecks.length === 0 ? (
                <div className="empty-state">
                  <span>📭</span>
                  <span>No payment checks yet</span>
                </div>
              ) : (
                <>
                  <div className="checks-list">
                    {paginatedPaymentChecks.map((check) => (
                      <div key={check.id} className="check-item">
                        <div className="check-header">
                          <span className="check-type">{check.type === "PAYMENT_RECEIPT" ? "💳 Payment" : "📄 E-Visa"}</span>
                          <span className={`check-status ${check.status.toLowerCase()}`}>
                            {check.status === "FOUND" ? "✅ Found" : check.status === "ERROR" ? "⚠️ Error" : "❌ Not Found"}
                          </span>
                        </div>
                        <div className="check-details">
                          {check.type === "PAYMENT_RECEIPT" ? (
                            <div className="check-field"><strong>Serial:</strong> {check.serialNumber}</div>
                          ) : (
                            <>
                              <div className="check-field"><strong>Passport:</strong> {check.passportNumber}</div>
                              <div className="check-field"><strong>Ref:</strong> {check.referenceNumber}</div>
                              <div className="check-field"><strong>Date:</strong> {check.visaMonth} {check.visaYear}</div>
                            </>
                          )}
                        </div>
                        <div className="check-footer">
                          <span className="checker-info">{check.checkedByUser.fullName} ({check.checkedByUser.role})</span>
                          <span className="check-time">{new Date(check.createdAt).toLocaleString()}</span>
                        </div>
                        {check.resultUrl && (
                          <a href={check.resultUrl} target="_blank" rel="noopener noreferrer" className="btn-view-result">🔗 View Result</a>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="pagination-bar">
                    <span className="pagination-info">Showing {(paymentPage - 1) * PAYMENT_PAGE_SIZE + 1}–{Math.min(paymentPage * PAYMENT_PAGE_SIZE, filteredPaymentChecks.length)} of {filteredPaymentChecks.length}</span>
                    <div className="pagination-controls">
                      <button type="button" className="btn-small" disabled={paymentPage <= 1} onClick={() => setPaymentPage((p) => p - 1)}>← Prev</button>
                      <span className="pagination-page">Page {paymentPage} of {paymentTotalPages}</span>
                      <button type="button" className="btn-small" disabled={paymentPage >= paymentTotalPages} onClick={() => setPaymentPage((p) => p + 1)}>Next →</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Privileges Tab */}
        {activeTab === "privileges" && (
          <div className="sa-section">
            <div className="section-header">
              <h1 className="sa-page-title">User Privileges</h1>
              <div className="section-actions">
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
          <div className="sa-section">
            <div className="section-header">
              <h1 className="sa-page-title">Role Policies</h1>
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

        {/* Audit Logs Tab */}
        {activeTab === "audit-logs" && (
          <div className="sa-section">
            <div className="section-header">
              <h1 className="sa-page-title">Activity Logs</h1>
              <p className="sa-page-sub">Filter and export activity history</p>
              <div className="section-actions">
                <button type="button" className="btn-secondary" onClick={() => { loadAuditLogs(); setAuditPage(1); }}>🔄 Refresh</button>
                <button type="button" className="btn-secondary" onClick={exportAuditCsv}>⬇️ Export CSV</button>
              </div>
            </div>
            <div className="filters-row">
              <input className="input" placeholder="Search action or actor" value={auditSearch} onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }} />
              <select className="input" value={auditUserFilter} onChange={(e) => setAuditUserFilter(e.target.value)}>
                <option value="">All users</option>
                {users.map((u) => (<option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>))}
              </select>
              <select className="input" value={auditRoleFilter} onChange={(e) => setAuditRoleFilter(e.target.value as any)}>
                <option value="ALL">All roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Admin</option>
                <option value="CHECKER">Checker</option>
                <option value="OFFICER">Officer</option>
              </select>
              <input type="date" className="input" value={auditDateFrom} onChange={(e) => setAuditDateFrom(e.target.value)} />
              <input type="date" className="input" value={auditDateTo} onChange={(e) => setAuditDateTo(e.target.value)} />
            </div>
            <div className="card">
              {filteredAuditLogs.length === 0 ? (
                <div className="empty-state">
                  <span>📭</span>
                  <span>No activity recorded yet</span>
                </div>
              ) : (
                <>
                  <div className="log-table">
                    <div className="log-header">
                      <span>Action</span>
                      <span>Actor</span>
                      <span>Target</span>
                      <span>Time</span>
                    </div>
                    {paginatedAuditLogs.map((log) => (
                      <div key={log.id} className="log-row">
                        <span>{log.action}</span>
                        <span>{log.actor?.fullName || "—"} ({log.actor?.role || "N/A"})</span>
                        <span>{log.targetType ? `${log.targetType} ${log.targetId || ""}` : "—"}</span>
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pagination-bar">
                    <span className="pagination-info">Showing {(auditPage - 1) * AUDIT_PAGE_SIZE + 1}–{Math.min(auditPage * AUDIT_PAGE_SIZE, filteredAuditLogs.length)} of {filteredAuditLogs.length}</span>
                    <div className="pagination-controls">
                      <button type="button" className="btn-small" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)}>← Prev</button>
                      <span className="pagination-page">Page {auditPage} of {auditTotalPages}</span>
                      <button type="button" className="btn-small" disabled={auditPage >= auditTotalPages} onClick={() => setAuditPage((p) => p + 1)}>Next →</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      <style jsx>{`
        .super-admin-content {
          width: 100%;
          max-width: 100%;
          padding: 0 16px 24px;
          box-sizing: border-box;
        }

        .sa-dashboard,
        .sa-section {
          animation: saFadeIn 0.3s ease-out;
          max-width: 1400px;
          margin: 0 auto;
        }
        @keyframes saFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .sa-page-title {
          margin: 0 0 6px;
          font-size: clamp(1.25rem, 4vw, 1.6rem);
          font-weight: 700;
          color: white;
          letter-spacing: -0.02em;
        }
        .sa-page-sub {
          margin: 0 0 24px;
          font-size: 0.95rem;
          color: #94a3b8;
        }

        .sa-dashboard-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
        }
        .sa-dashboard-head .sa-page-title { margin: 0; }
        .sa-dashboard-head .sa-page-sub { margin: 0; flex: 1; }
        .sa-refresh-btn {
          padding: 10px 20px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sa-refresh-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .sa-summary-section { margin-bottom: 32px; }
        .sa-summary-heading {
          margin: 0 0 16px;
          font-size: 1rem;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .summary-card {
          cursor: pointer;
          transition: transform 0.2s;
        }
        .summary-card:hover {
          transform: translateY(-2px);
        }
        .summary-link {
          display: inline-block;
          margin-top: 12px;
          font-size: 13px;
          color: #38bdf8;
          font-weight: 600;
        }
        .summary-card-sm .summary-values { font-size: 0.9rem; }

        .sa-quick-nav { margin-bottom: 32px; }
        .sa-quick-nav-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px;
        }
        .sa-quick-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          padding: 20px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.05);
          color: #e2e8f0;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .sa-quick-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(56, 189, 248, 0.3);
          transform: translateY(-2px);
        }
        .sa-quick-icon { font-size: 1.75rem; }
        .sa-quick-label { font-weight: 700; font-size: 1rem; }
        .sa-quick-desc { font-size: 13px; color: #94a3b8; }

        .sa-recent-section { margin-bottom: 28px; }
        .sa-recent-card {
          padding: 20px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.05);
        }
        .sa-recent-list {
          list-style: none;
          margin: 0 0 16px;
          padding: 0;
        }
        .sa-recent-item {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 14px;
        }
        .sa-recent-item:last-child { border-bottom: none; }
        .sa-recent-action { font-weight: 600; color: #e2e8f0; }
        .sa-recent-actor { color: #cbd5e1; }
        .sa-recent-meta { color: #94a3b8; font-size: 13px; }
        .sa-recent-time { color: #64748b; font-size: 12px; margin-left: auto; }
        .sa-recent-status { padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; }
        .sa-recent-status-found { background: rgba(34, 197, 94, 0.2); color: #86efac; }
        .sa-recent-status-not_found { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .sa-recent-status-error { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
        .sa-recent-empty { margin: 0 0 16px; color: #64748b; font-size: 14px; }
        .sa-recent-more {
          padding: 10px 0;
          border: none;
          background: none;
          color: #38bdf8;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .sa-recent-more:hover { text-decoration: underline; }

        .sa-activity-summary { margin-bottom: 24px; }
        .sa-activity-total {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 16px;
        }
        .sa-activity-total-n { font-size: 28px; font-weight: 700; color: #e2e8f0; }
        .sa-activity-total-label { font-size: 14px; color: #94a3b8; }
        .sa-activity-by { display: flex; flex-wrap: wrap; gap: 20px; }
        .sa-activity-by-block { display: flex; flex-direction: column; gap: 8px; }
        .sa-activity-by-title { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .sa-activity-pills { display: flex; flex-wrap: wrap; gap: 8px; }
        .sa-activity-pills span {
          padding: 6px 12px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          font-size: 13px;
        }
        .sa-activity-count { margin-left: 6px; color: #94a3b8; font-weight: 600; }

        .sa-top10-wrap { overflow: hidden; }
        .sa-top10-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 12px; }
        .sa-top10-table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 13px; }
        .sa-top10-table th, .sa-top10-table td { padding: 10px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); text-align: left; }
        .sa-top10-table th { color: #94a3b8; font-weight: 600; font-size: 11px; text-transform: uppercase; }
        .sa-top10-name { font-weight: 600; color: #e2e8f0; }
        .sa-cell-good { color: #86efac; }
        .sa-cell-warn { color: #fde047; }
        .sa-cell-error { color: #fca5a5; }

        .pagination-bar {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px 0 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 16px;
        }
        .pagination-info { font-size: 13px; color: #94a3b8; }
        .pagination-controls { display: flex; align-items: center; gap: 12px; }
        .pagination-page { font-size: 13px; color: #cbd5e1; }

        .users-list-card {
          display: flex;
          flex-direction: column;
          min-height: 280px;
          border-radius: 16px;
          overflow: hidden;
        }
        .users-list-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }
        .users-list-card-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #f1f5f9; }
        .users-list-card-count { font-size: 13px; color: #94a3b8; font-weight: 600; padding: 4px 12px; background: rgba(255,255,255,0.08); border-radius: 20px; }
        .users-loading-state { min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: #94a3b8; padding: 32px; }
        .loading-spinner { font-size: 2.2rem; animation: spin 0.9s linear infinite; display: inline-block; color: #38bdf8; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .sa-users-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin: 0;
          display: block;
          flex: 1;
          min-height: 120px;
        }
        .sa-users-table {
          width: 100%;
          min-width: 540px;
          border-collapse: collapse;
          font-size: 14px;
        }
        .sa-users-table thead { position: sticky; top: 0; z-index: 1; }
        .sa-users-table th, .sa-users-table td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          text-align: left;
          vertical-align: middle;
          background: rgba(255, 255, 255, 0.02);
        }
        .sa-users-table thead tr { background: rgba(30, 41, 59, 0.95); }
        .sa-users-table thead th {
          color: #94a3b8;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .sa-users-table tbody tr.sa-users-tr:nth-child(even) td { background: rgba(255, 255, 255, 0.04); }
        .sa-users-table tbody tr.sa-users-tr:hover td { background: rgba(255, 255, 255, 0.07); }
        .sa-users-th-check, .sa-users-td-check { width: 48px; text-align: center; }
        .sa-users-th-check input, .sa-users-td-check input { width: 18px; height: 18px; accent-color: #38bdf8; cursor: pointer; }
        .sa-users-name { font-weight: 600; color: #f1f5f9; }
        .sa-users-td-phone { color: #cbd5e1; font-variant-numeric: tabular-nums; font-size: 13px; }
        .sa-users-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .role-select-inline { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.08); color: #e2e8f0; font-size: 13px; min-width: 100px; }

        .summary-grid-responsive { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }

        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          left: 20px;
          padding: 14px 18px;
          background: rgba(30, 41, 59, 0.98);
          backdrop-filter: blur(12px);
          color: white;
          border-radius: 14px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
          z-index: 120;
          cursor: pointer;
          font-size: 14px;
          line-height: 1.4;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .summary-card {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 24px;
          color: #e2e8f0;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
          position: relative;
          overflow: hidden;
        }

        .glow::after {
          content: "";
          position: absolute;
          inset: -40%;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.12), transparent 55%);
          animation: floatGlow 8s ease-in-out infinite alternate;
          pointer-events: none;
        }

        @keyframes floatGlow {
          from { transform: translateX(-10%) translateY(-5%); }
          to { transform: translateX(6%) translateY(4%); }
        }

        .summary-title {
          font-weight: 700;
          margin-bottom: 12px;
          font-size: 1.1rem;
          position: relative;
          z-index: 1;
        }

        .summary-values {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-weight: 600;
          font-size: 0.95rem;
          position: relative;
          z-index: 1;
        }

        .summary-values .good { color: #86efac; }
        .summary-values .warn { color: #fde047; }
        .summary-values .error { color: #fca5a5; }

        .summary-pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
          position: relative;
          z-index: 1;
        }

        .section-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }

        .section-header .sa-page-title {
          margin: 0;
        }

        .section-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .btn-create {
          padding: 12px 20px;
          min-height: 44px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
          border-radius: 14px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-create:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
        }

        .card {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
          color: #e2e8f0;
          backdrop-filter: blur(10px);
        }

        .users-card,
        .checks-card {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(10px);
        }

        .users-card.compact .user-item {
          padding: 12px 14px;
          gap: 10px;
        }

        .users-list,
        .checks-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .user-item {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          transition: background 0.2s;
        }
        .user-item:hover {
          background: rgba(255, 255, 255, 0.07);
        }
        .user-item.fade-card {
          animation: saFadeIn 0.25s ease-out;
        }

        .user-avatar-sm {
          width: 48px;
          height: 48px;
          min-width: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .user-details {
          flex: 1;
          min-width: 0;
        }

        .user-name {
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 4px;
          font-size: 1rem;
        }

        .user-meta {
          font-size: 13px;
          color: #94a3b8;
        }

        .user-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .status-badge {
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .status-badge.active {
          background: rgba(34, 197, 94, 0.2);
          color: #86efac;
        }
        .status-badge.inactive {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .btn-toggle {
          padding: 8px 14px;
          min-height: 40px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          color: #e2e8f0;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-toggle:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .action-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-small {
          padding: 8px 14px;
          min-height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-small.danger {
          border-color: rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
        }
        .btn-small:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        .btn-small.danger:hover {
          background: rgba(239, 68, 68, 0.25);
        }

        .role-select {
          min-height: 40px;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(15, 23, 42, 0.6);
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 600;
        }
        
        .check-item {
          padding: 18px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .check-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .check-type {
          font-weight: 600;
          color: #e2e8f0;
          font-size: 14px;
        }
        .check-status {
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .check-status.found {
          background: rgba(34, 197, 94, 0.2);
          color: #86efac;
        }
        .check-status.not_found {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }
        .check-status.error {
          background: rgba(245, 158, 11, 0.2);
          color: #fcd34d;
        }
        .check-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 12px;
        }
        .check-field {
          font-size: 13px;
          color: #94a3b8;
        }
        .check-field strong {
          color: #e2e8f0;
          margin-right: 6px;
        }
        .check-footer {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .checker-info {
          font-size: 13px;
          color: #94a3b8;
        }
        .check-time {
          font-size: 12px;
          color: #64748b;
        }
        .btn-view-result {
          display: inline-block;
          margin-top: 12px;
          padding: 10px 18px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          text-decoration: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-view-result:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }

        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: #94a3b8;
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
        }
        .empty-state span:first-child {
          font-size: 3rem;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 16px;
          overflow-y: auto;
        }
        .modal-content {
          background: #1e293b;
          border-radius: 24px;
          width: 100%;
          max-width: 480px;
          padding: 28px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .modal-header h3 {
          font-size: 1.3rem;
          font-weight: 700;
          margin: 0;
          color: white;
        }
        .close-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          cursor: pointer;
          font-size: 1.2rem;
          color: #94a3b8;
          transition: background 0.2s;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.14);
        }
        .form-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #cbd5e1;
          margin-bottom: 8px;
        }
        .input {
          width: 100%;
          padding: 14px 18px;
          min-height: 48px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(15, 23, 42, 0.6);
          color: white;
          font-size: 16px;
          transition: all 0.2s;
        }
        .input:focus {
          outline: none;
          border-color: rgba(56, 189, 248, 0.5);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
        }
        .input::placeholder {
          color: #64748b;
        }
        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 28px;
          flex-wrap: wrap;
        }
        .btn-primary {
          flex: 1;
          min-width: 140px;
          padding: 14px 24px;
          min-height: 48px;
          background: linear-gradient(135deg, #22c55e, #0ea5e9);
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-secondary {
          flex: 1;
          min-width: 120px;
          padding: 14px 24px;
          min-height: 48px;
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
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
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: white;
          font-weight: 600;
        }

        .log-table {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .log-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1.4fr;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          color: #94a3b8;
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
        }
        .log-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1.4fr;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          color: #e2e8f0;
          font-size: 14px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .priv-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
          margin-top: 16px;
        }
        .priv-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #e2e8f0;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .priv-item input {
          width: 18px;
          height: 18px;
          accent-color: #38bdf8;
        }

        .officer-priv-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin: 16px 0;
        }
        .officer-priv-table {
          width: 100%;
          min-width: 400px;
          border-collapse: collapse;
          font-size: 14px;
        }
        .officer-priv-table th,
        .officer-priv-table td {
          padding: 14px 16px;
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
          gap: 10px;
          cursor: pointer;
          color: #cbd5e1;
        }
        .officer-priv-check-label input {
          width: 20px;
          height: 20px;
          accent-color: #38bdf8;
        }

        .priv-group {
          margin-top: 20px;
        }
        .priv-group-title {
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .template-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          margin: 16px 0;
        }
        .label-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 0 12px;
          flex-wrap: wrap;
        }
        .label {
          font-weight: 700;
          color: #e2e8f0;
        }
        .label-muted {
          color: #94a3b8;
          font-size: 13px;
        }

        .filters-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 16px;
          align-items: center;
        }
        .filters-row .input {
          min-width: 160px;
          flex: 1;
        }
        .bulk-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin: 16px 0;
        }
        .stat-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .policy-table {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .policy-header {
          display: grid;
          grid-template-columns: 1.2fr repeat(5, 1fr);
          gap: 10px;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          color: #94a3b8;
          font-weight: 700;
          font-size: 12px;
        }
        .policy-row {
          display: grid;
          grid-template-columns: 1.2fr repeat(5, 1fr);
          gap: 10px;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          color: #e2e8f0;
          border: 1px solid rgba(255, 255, 255, 0.06);
          align-items: center;
        }
        .policy-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          cursor: pointer;
        }
        .policy-toggle input {
          width: 18px;
          height: 18px;
          accent-color: #38bdf8;
        }

        .muted {
          color: #94a3b8;
          font-size: 14px;
        }
        .filter-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          color: #cbd5e1;
          font-size: 14px;
        }
        .filter-check input {
          width: 18px;
          height: 18px;
          accent-color: #38bdf8;
        }

        @media (max-width: 768px) {
          .super-admin-content { padding: 0 12px 20px; }
          .toast {
            left: 12px;
            right: 12px;
            top: 12px;
            padding: 12px 16px;
            font-size: 13px;
          }
          .sa-dashboard-head { flex-direction: column; align-items: stretch; gap: 12px; }
          .sa-refresh-btn { align-self: flex-start; }
          .summary-grid,
          .summary-grid-responsive {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .summary-card { padding: 18px; }
          .summary-values { font-size: 0.9rem; }
          .sa-quick-nav-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .sa-quick-card { padding: 14px; }
          .sa-quick-label { font-size: 0.9rem; }
          .sa-quick-desc { font-size: 12px; }
          .sa-top10-table-wrap { margin: 0 -4px 12px; }
          .sa-top10-table th, .sa-top10-table td { padding: 8px 10px; font-size: 12px; }
          .sa-recent-item { flex-wrap: wrap; gap: 8px; font-size: 13px; }
          .section-header {
            flex-direction: column;
            align-items: stretch;
          }
          .section-actions {
            justify-content: flex-start;
          }
          .pagination-bar { flex-direction: column; align-items: stretch; text-align: center; }
          .user-item {
            flex-direction: column;
            align-items: stretch;
          }
          .user-actions {
            width: 100%;
            justify-content: flex-start;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 12px;
          }
          .users-list-card-head { padding: 12px 16px; }
          .sa-users-table-wrap { min-height: 100px; }
          .sa-users-table { min-width: 480px; }
          .sa-users-table th, .sa-users-table td { padding: 10px 12px; font-size: 13px; }
          .sa-users-actions { flex-wrap: wrap; }
          .log-table {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .log-header,
          .log-row {
            min-width: 520px;
          }
          .policy-table {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .policy-header,
          .policy-row {
            min-width: 480px;
          }
          .modal-content {
            padding: 20px;
          }
        }

        @media (max-width: 480px) {
          .super-admin-content { padding: 0 10px 16px; }
          .sa-quick-nav-grid { grid-template-columns: 1fr; }
          .sa-summary-heading { font-size: 1rem; }
          .users-list-card-head { flex-direction: column; align-items: flex-start; }
          .bulk-row {
            flex-direction: column;
            align-items: stretch;
          }
          .action-buttons {
            justify-content: stretch;
          }
          .action-buttons .btn-small {
            flex: 1;
          }
          .pagination-controls { flex-wrap: wrap; justify-content: center; }
        }
      `}</style>
      </div>
    </SidebarLayout>
  );
}
