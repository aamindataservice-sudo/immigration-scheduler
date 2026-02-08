import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Get payment checks for the current checker user
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "User ID required" },
        { status: 400 }
      );
    }

    // Verify user is CHECKER or SUPER_ADMIN
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || (user.role !== "CHECKER" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get payment checks for this user
    const checks = await prisma.paymentCheck.findMany({
      where: { checkedBy: userId },
      take: limit,
      orderBy: { createdAt: "desc" },
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
