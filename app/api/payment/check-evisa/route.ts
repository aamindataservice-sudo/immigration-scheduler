import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

/**
 * Check if e-Visa PDF exists
 * Based on PHP code: https://immigration.etas.gov.so/uploads/{year}/{month}/reverified_online_e_visa_pdf/{passport}_{reference}.pdf
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const passportNumber = String(body?.passportNumber ?? "").trim();
    const referenceNumber = String(body?.referenceNumber ?? "").trim();
    const visaYear = String(body?.visaYear ?? "").trim();
    const visaMonth = String(body?.visaMonth ?? "").trim();
    const checkedBy = String(body?.checkedBy ?? "");

    if (!passportNumber) {
      return NextResponse.json(
        { ok: false, error: "Passport number required" },
        { status: 400 }
      );
    }

    if (!referenceNumber || !visaYear || !visaMonth) {
      return NextResponse.json(
        { ok: false, error: "Reference number, year and month required" },
        { status: 400 }
      );
    }

    if (!checkedBy) {
      return NextResponse.json(
        { ok: false, error: "Checker user ID required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: checkedBy }, select: { role: true, id: true } });
    const privilege = await prisma.userPrivilege.findUnique({ where: { userId: checkedBy } });
    if (
      !user ||
      !(
        user.role === "SUPER_ADMIN" ||
        privilege?.canCheckEVisa ||
        privilege?.canCheckPayment
      )
    ) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Validate year and month
    const allowedYears = ["2025", "2026", "2027"];
    const allowedMonths = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    if (!allowedYears.includes(visaYear)) {
      return NextResponse.json(
        { ok: false, error: "Invalid visa year" },
        { status: 400 }
      );
    }

    if (!allowedMonths.includes(visaMonth)) {
      return NextResponse.json(
        { ok: false, error: "Invalid visa month" },
        { status: 400 }
      );
    }

    // Build e-Visa URL (exactly like PHP)
    // PHP: $visaBaseUrl . rawurlencode($visaYear) . '/' . rawurlencode($visaMonth) . '/reverified_online_e_visa_pdf/' . rawurlencode($passport . '_' . $reference . '.pdf') . '?';
    const visaBaseUrl = "https://immigration.etas.gov.so/uploads/";
    
    // Year and month don't need encoding (safe characters)
    // Only encode the filename part
    const filename = `${passportNumber}_${referenceNumber}.pdf`;
    const visaUrl = `${visaBaseUrl}${visaYear}/${visaMonth}/reverified_online_e_visa_pdf/${encodeURIComponent(filename)}?`;

    let status: "FOUND" | "NOT_FOUND" | "ERROR" = "NOT_FOUND";
    let resultUrl: string | null = null;

    try {
      const response = await fetch(visaUrl, { method: "HEAD" });
      if (response.ok && response.status === 200) {
        status = "FOUND";
        resultUrl = visaUrl;
      }
    } catch (error) {
      status = "ERROR";
    }

    const paymentCheck = await prisma.paymentCheck.create({
      data: {
        type: "EVISA",
        passportNumber,
        referenceNumber,
        visaYear,
        visaMonth,
        status,
        resultUrl,
        checkedBy,
      },
    });

    await logAudit({
      actorId: checkedBy,
      action: "CHECK_EVISA",
      targetType: "PaymentCheck",
      targetId: paymentCheck.id,
      metadata: { passportNumber, referenceNumber, status },
    });

    return NextResponse.json({
      ok: true,
      check: {
        id: paymentCheck.id,
        status,
        visaUrl: resultUrl,
        message:
          status === "FOUND"
            ? "E-Visa found and ready for download"
            : status === "ERROR"
            ? "Error checking e-Visa"
            : "E-Visa not found or not ready yet",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error" },
      { status: 500 }
    );
  }
}
