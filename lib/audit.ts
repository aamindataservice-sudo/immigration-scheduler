import { prisma } from "./prisma";

type AuditParams = {
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, any>;
};

export async function logAudit(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        metadata: params.metadata ?? {},
      },
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

export async function ensureRolePolicies() {
  const roles: Array<"SUPER_ADMIN" | "ADMIN" | "CHECKER" | "OFFICER"> = [
    "SUPER_ADMIN",
    "ADMIN",
    "CHECKER",
    "OFFICER",
  ];
  for (const role of roles) {
    await prisma.roleCreationPolicy.upsert({
      where: { role },
      update: {},
      create: {
        role,
        // Default: all allowed; SUPER_ADMIN handled via requester role checks.
        isAllowed: true,
        allowUpdate: true,
        allowDeactivate: true,
        allowDelete: false,
        allowPasswordReset: true,
      },
    });
  }
}

export async function ensureUserPrivileges(userId: string, role: string) {
  const defaultsForRole = {
    canCheckPayment: role === "SUPER_ADMIN" || role === "CHECKER",
    canCheckEVisa: role === "SUPER_ADMIN" || role === "CHECKER",
    canScanMe: true,
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
  };

  await prisma.userPrivilege.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...defaultsForRole,
    },
  });
}
