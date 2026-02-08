import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureRolePolicies, logAudit } from "@/lib/audit";

async function getRequester(requesterId?: string) {
  if (!requesterId) return null;
  return prisma.user.findUnique({ where: { id: requesterId } });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requesterId = searchParams.get("requesterId") ?? undefined;
  const requester = await getRequester(requesterId);
  if (!requester || requester.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  await ensureRolePolicies();
  const policies = await prisma.roleCreationPolicy.findMany();
  return NextResponse.json({ ok: true, policies });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requesterId: string | undefined = body?.requesterId;
    const updates: Array<{
      role: string;
      isAllowed?: boolean;
      allowUpdate?: boolean;
      allowDeactivate?: boolean;
      allowDelete?: boolean;
      allowPasswordReset?: boolean;
    }> = body?.policies ?? [];
    const requester = await getRequester(requesterId);
    if (!requester || requester.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    await ensureRolePolicies();

    for (const item of updates) {
      if (!item?.role) continue;
      const role = item.role as any;
      if (role === "SUPER_ADMIN") continue; // Always restricted to super admin creation
      if (!["ADMIN", "CHECKER", "OFFICER"].includes(role)) continue;
      await prisma.roleCreationPolicy.upsert({
        where: { role },
        update: {
          isAllowed: item.isAllowed ?? undefined,
          allowUpdate: item.allowUpdate ?? undefined,
          allowDeactivate: item.allowDeactivate ?? undefined,
          allowDelete: item.allowDelete ?? undefined,
          allowPasswordReset: item.allowPasswordReset ?? undefined,
          updatedBy: requester.id,
        },
        create: {
          role,
          isAllowed: item.isAllowed ?? true,
          allowUpdate: item.allowUpdate ?? true,
          allowDeactivate: item.allowDeactivate ?? true,
          allowDelete: item.allowDelete ?? false,
          allowPasswordReset: item.allowPasswordReset ?? true,
          updatedBy: requester.id,
        },
      });
    }

    await logAudit({
      actorId: requester.id,
      action: "policy.role.update",
      metadata: { updates },
    });

    const policies = await prisma.roleCreationPolicy.findMany();
    return NextResponse.json({ ok: true, policies });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
