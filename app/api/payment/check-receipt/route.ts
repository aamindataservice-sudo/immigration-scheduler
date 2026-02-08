import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Check if payment receipt exists
 * Based on PHP code: https://etas.gov.so/receipt/{serialNumber}
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const serialNumber = String(body?.serialNumber ?? "").trim();
    const checkedBy = String(body?.checkedBy ?? "");

    if (!serialNumber) {
      return NextResponse.json(
        { ok: false, error: "Serial number required" },
        { status: 400 }
      );
    }

    if (!checkedBy) {
      return NextResponse.json(
        { ok: false, error: "Checker user ID required" },
        { status: 400 }
      );
    }

    // Verify user exists and is a CHECKER
    const user = await prisma.user.findUnique({
      where: { id: checkedBy },
    });

    if (!user || (user.role !== "CHECKER" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Build receipt URL (like PHP - no pre-check, just redirect)
    const paymentBaseUrl = "https://etas.gov.so/receipt/";
    const receiptUrl = `${paymentBaseUrl}${encodeURIComponent(serialNumber)}`;

    // Like PHP: don't check if exists, just log and return URL
    // The browser will open it and user will see if it exists
    const status: "FOUND" = "FOUND"; // Always "FOUND" since we don't pre-check
    const resultUrl = receiptUrl;

    // Save payment check to database
    const paymentCheck = await prisma.paymentCheck.create({
      data: {
        type: "PAYMENT_RECEIPT",
        serialNumber,
        status,
        resultUrl,
        checkedBy,
      },
    });

    return NextResponse.json({
      ok: true,
      check: {
        id: paymentCheck.id,
        status,
        receiptUrl: resultUrl,
        message: "Opening payment receipt...",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error" },
      { status: 500 }
    );
  }
}
