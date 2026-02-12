import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET: Activity summary for super admin dashboard.
 * Returns: totalActivities, byAction, byRole, topUsers (top 10 by activity count), lastSeen (users sorted by last activity).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requesterId = searchParams.get("requesterId") ?? "";
  if (!requesterId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }
  const requester = await prisma.user.findUnique({ where: { id: requesterId } });
  if (!requester || requester.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const limit = 2000;
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { id: true, fullName: true, phone: true, role: true } } },
  });

  const byAction: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  type ActorStats = {
    count: number;
    lastSeenAt: string;
    fullName: string;
    role: string;
    checkPayment: number;
    checkEvisa: number;
    downloadReceipt: number;
    scanMe: number;
    login: number;
    found: number;
    notFound: number;
    error: number;
  };
  const byActor = new Map<string, ActorStats>();

  const getStatus = (meta: unknown): "found" | "not_found" | "error" | null => {
    if (!meta || typeof meta !== "object") return null;
    const m = meta as Record<string, unknown>;
    const s = (m.status as string)?.toUpperCase?.();
    if (s === "FOUND") return "found";
    if (s === "NOT_FOUND") return "not_found";
    if (s === "ERROR") return "error";
    return null;
  };

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] ?? 0) + 1;
    if (log.actor) {
      byRole[log.actor.role] = (byRole[log.actor.role] ?? 0) + 1;
      const key = log.actor.id;
      const createdAt = log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt);
      let existing = byActor.get(key);
      if (!existing) {
        existing = {
          count: 0,
          lastSeenAt: createdAt,
          fullName: log.actor.fullName ?? "",
          role: log.actor.role ?? "",
          checkPayment: 0,
          checkEvisa: 0,
          downloadReceipt: 0,
          scanMe: 0,
          login: 0,
          found: 0,
          notFound: 0,
          error: 0,
        };
        byActor.set(key, existing);
      }
      existing.count += 1;
      if (createdAt > existing.lastSeenAt) existing.lastSeenAt = createdAt;
      if (log.action === "CHECK_PAYMENT") existing.checkPayment += 1;
      else if (log.action === "CHECK_EVISA") existing.checkEvisa += 1;
      else if (log.action === "DOWNLOAD_RECEIPT") existing.downloadReceipt += 1;
      else if (log.action === "SCAN_ME") existing.scanMe += 1;
      else if (log.action === "LOGIN") existing.login += 1;
      const status = getStatus(log.metadata);
      if (status === "found") existing.found += 1;
      else if (status === "not_found") existing.notFound += 1;
      else if (status === "error") existing.error += 1;
    }
  }

  const topUsers = Array.from(byActor.entries())
    .map(([userId, v]) => ({
      userId,
      fullName: v.fullName,
      role: v.role,
      count: v.count,
      checkPayment: v.checkPayment,
      checkEvisa: v.checkEvisa,
      downloadReceipt: v.downloadReceipt,
      scanMe: v.scanMe,
      login: v.login,
      found: v.found,
      notFound: v.notFound,
      error: v.error,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const lastSeen = Array.from(byActor.entries())
    .map(([userId, v]) => ({
      userId,
      fullName: v.fullName,
      role: v.role,
      lastSeenAt: v.lastSeenAt,
    }))
    .sort((a, b) => (b.lastSeenAt > a.lastSeenAt ? 1 : -1));

  return NextResponse.json({
    ok: true,
    totalActivities: logs.length,
    byAction,
    byRole,
    topUsers,
    lastSeen,
  });
}
