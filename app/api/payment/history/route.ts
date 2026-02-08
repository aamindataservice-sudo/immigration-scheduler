import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Get payment check history for super admin
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "100");

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "User ID required" },
        { status: 400 }
      );
    }

    // Verify user is SUPER_ADMIN
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Super Admin only." },
        { status: 403 }
      );
    }

    // Get all payment checks with user info
    const checks = await prisma.paymentCheck.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        checkedByUser: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      checks,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error" },
      { status: 500 }
    );
  }
}
