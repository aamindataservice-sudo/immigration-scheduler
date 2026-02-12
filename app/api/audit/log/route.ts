import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

/**
 * POST: Log an activity from the client (e.g. Scan Me result).
 * Body: { actorId, action, targetType?, targetId?, metadata? }
 * Only OFFICER, CHECKER, SUPER_ADMIN can log. actorId must match a valid user.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const actorId = String(body?.actorId ?? "").trim();
    const action = String(body?.action ?? "").trim();
    const targetType = body?.targetType ? String(body.targetType) : null;
    const targetId = body?.targetId ? String(body.targetId) : null;
    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : undefined;

    if (!actorId || !action) {
      return NextResponse.json({ ok: false, error: "actorId and action required" }, { status: 400 });
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, isActive: true },
    });

    if (!actor || !actor.isActive) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const allowedRoles = ["SUPER_ADMIN", "ADMIN", "CHECKER", "OFFICER"];
    if (!allowedRoles.includes(actor.role)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    await logAudit({
      actorId: actor.id,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      metadata: metadata ?? {},
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
