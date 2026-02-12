import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getMogadishuTodayISO } from "@/lib/time";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get("requesterId") ?? "";
    const officerId = searchParams.get("officerId") ?? "";

    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });
    if (!requester) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }
    if (requester.role !== "CHECKER" && requester.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const where: { createdBy?: string; officerId?: string } = {};
    if (requester.role === "CHECKER") where.createdBy = requesterId;
    if (officerId) where.officerId = officerId;

    let list = await prisma.officerPenalty.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        officer: { select: { id: true, fullName: true, phone: true, role: true } },
        createdByUser: { select: { id: true, fullName: true } },
      },
    });

    const today = getMogadishuTodayISO();
    for (const p of list) {
      if (p.lastResetDate === null) {
        await prisma.officerPenalty.update({
          where: { id: p.id },
          data: { lastResetDate: today },
        });
        (p as { lastResetDate: string | null }).lastResetDate = today;
      } else if (p.lastResetDate < today) {
        await prisma.penaltyDaySnapshot.upsert({
          where: {
            officerPenaltyId_date: { officerPenaltyId: p.id, date: p.lastResetDate },
          },
          create: { officerPenaltyId: p.id, date: p.lastResetDate, count: p.count },
          update: { count: p.count },
        });
        await prisma.officerPenalty.update({
          where: { id: p.id },
          data: { count: 0, lastResetDate: today },
        });
        (p as { count: number; lastResetDate: string | null }).count = 0;
        (p as { lastResetDate: string | null }).lastResetDate = today;
      }
    }

    return NextResponse.json({ ok: true, list });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requesterId = (body?.requesterId ?? "").trim();
    const officerId = (body?.officerId ?? "").trim() || null;
    const stampNo = (body?.stampNo ?? "").trim();
    const note = body?.note != null ? String(body.note).trim() : "";
    const count = Math.max(0, parseInt(String(body?.count ?? 0), 10) || 0);
    let color = (body?.color ?? "").trim() || null;

    if (!requesterId || !stampNo) {
      return NextResponse.json({ ok: false, error: "requesterId and stampNo required" }, { status: 400 });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });
    if (!requester) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }
    if (requester.role !== "CHECKER" && requester.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    if (officerId) {
      const officer = await prisma.user.findUnique({
        where: { id: officerId },
        select: { id: true, fullName: true, role: true },
      });
      if (!officer || officer.role !== "OFFICER") {
        return NextResponse.json({ ok: false, error: "Officer not found" }, { status: 400 });
      }
    }

    const PALETTE = [
      "#0f766e", "#0369a1", "#b45309", "#6b21a8", "#059669", "#dc2626", "#0ea5e9", "#8b5cf6",
      "#ca8a04", "#c026d3", "#0d9488", "#2563eb", "#ea580c", "#4f46e5", "#16a34a", "#be123c",
      "#0891b2", "#7c3aed", "#65a30d", "#db2777", "#1d4ed8", "#15803d", "#a21caf", "#c2410c",
      "#1e40af", "#047857", "#7e22ce", "#b91c1c", "#1e3a8a", "#166534", "#581c87", "#134e4a",
    ];
    if (!color) {
      const existing = await prisma.officerPenalty.findMany({
        where: requester.role === "CHECKER" ? { createdBy: requesterId } : {},
        select: { color: true },
      });
      const used = new Set((existing.map((p) => p.color).filter(Boolean) as string[]).map((c) => c.toLowerCase()));
      const firstUnused = PALETTE.find((c) => !used.has(c.toLowerCase()));
      if (firstUnused) color = firstUnused;
      else color = `hsl(${(existing.length * 47) % 360}, 52%, 42%)`;
    }

    const created = await prisma.officerPenalty.create({
      data: {
        officerId: officerId || null,
        stampNo,
        note: note || null,
        color,
        count,
        createdBy: requesterId,
      },
      include: {
        officer: { select: { id: true, fullName: true, role: true } },
        createdByUser: { select: { id: true, fullName: true } },
      },
    });

    await logAudit({
      actorId: requesterId,
      action: "PENALTY_CREATE",
      targetType: "OfficerPenalty",
      targetId: created.id,
      metadata: { officerId: officerId || null, stampNo, note: note || null, count, color },
    });

    return NextResponse.json({ ok: true, penalty: created });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
