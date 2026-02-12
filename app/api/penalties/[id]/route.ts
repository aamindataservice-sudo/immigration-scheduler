import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getMogadishuTodayISO } from "@/lib/time";

/** PATCH: Update penalty (stampNo, note, or count delta). Body: requesterId, stampNo?, note?, countDelta? (+1, -1) or count? */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const requesterId = (body?.requesterId ?? "").trim();
    const stampNo = body?.stampNo != null ? String(body.stampNo).trim() : undefined;
    const note = body?.note !== undefined ? String(body.note).trim() : undefined;
    const color = body?.color !== undefined ? ((body.color ?? "").trim() || null) : undefined;
    const countDelta = body?.countDelta != null ? parseInt(String(body.countDelta), 10) : undefined;
    const count = body?.count != null ? Math.max(0, parseInt(String(body.count), 10) || 0) : undefined;

    if (!requesterId || !id) {
      return NextResponse.json({ ok: false, error: "requesterId and id required" }, { status: 400 });
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

    let existing = await prisma.officerPenalty.findUnique({
      where: { id },
      include: { officer: { select: { fullName: true } } },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Penalty not found" }, { status: 404 });
    }
    if (requester.role === "CHECKER" && existing.createdBy !== requesterId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const today = getMogadishuTodayISO();
    if (existing.lastResetDate === null) {
      await prisma.officerPenalty.update({
        where: { id },
        data: { lastResetDate: today },
      });
      existing = { ...existing, lastResetDate: today };
    } else if (existing.lastResetDate < today) {
      await prisma.penaltyDaySnapshot.upsert({
        where: {
          officerPenaltyId_date: { officerPenaltyId: id, date: existing.lastResetDate },
        },
        create: { officerPenaltyId: id, date: existing.lastResetDate, count: existing.count },
        update: { count: existing.count },
      });
      await prisma.officerPenalty.update({
        where: { id },
        data: { count: 0, lastResetDate: today },
      });
      existing = { ...existing, count: 0, lastResetDate: today };
    }

    let newCount = existing.count;
    if (count !== undefined) newCount = count;
    else if (countDelta !== undefined) newCount = Math.max(0, existing.count + countDelta);

    const updated = await prisma.officerPenalty.update({
      where: { id },
      data: {
        ...(stampNo !== undefined && { stampNo }),
        ...(note !== undefined && { note: note || null }),
        ...(color !== undefined && { color }),
        count: newCount,
      },
      include: {
        officer: { select: { id: true, fullName: true, role: true } },
        createdByUser: { select: { id: true, fullName: true } },
      },
    });

    await logAudit({
      actorId: requesterId,
      action: "PENALTY_UPDATE",
      targetType: "OfficerPenalty",
      targetId: id,
      metadata: { stampNo: updated.stampNo, note: updated.note, count: updated.count, countDelta },
    });

    return NextResponse.json({ ok: true, penalty: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

/** DELETE: Delete penalty */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get("requesterId") ?? "";

    if (!requesterId || !id) {
      return NextResponse.json({ ok: false, error: "requesterId and id required" }, { status: 400 });
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

    const existing = await prisma.officerPenalty.findUnique({
      where: { id },
      select: { id: true, createdBy: true, officerId: true, stampNo: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Penalty not found" }, { status: 404 });
    }
    if (requester.role === "CHECKER" && existing.createdBy !== requesterId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.officerPenalty.delete({ where: { id } });

    await logAudit({
      actorId: requesterId,
      action: "PENALTY_DELETE",
      targetType: "OfficerPenalty",
      targetId: id,
      metadata: { officerId: existing.officerId, stampNo: existing.stampNo },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
