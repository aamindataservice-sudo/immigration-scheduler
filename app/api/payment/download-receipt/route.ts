import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/**
 * Download payment receipt from remote server and save to local server
 * Then serve it to the user (like PHP downloadPdf function)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const serialNumber = String(body?.serialNumber ?? "").trim();
    const checkedBy = String(body?.checkedBy ?? "");
    const requester = await prisma.user.findUnique({ where: { id: checkedBy }, select: { role: true, id: true } });
    const privilege = checkedBy
      ? await prisma.userPrivilege.findUnique({ where: { userId: checkedBy } })
      : null;

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
    if (
      !requester ||
      !(
        requester.role === "SUPER_ADMIN" ||
        privilege?.canCheckPayment ||
        privilege?.canDownloadReceipt
      )
    ) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Build receipt URL
    const paymentBaseUrl = "https://etas.gov.so/receipt/";
    const receiptUrl = `${paymentBaseUrl}${encodeURIComponent(serialNumber)}`;

    // Try to download the receipt
    let downloadStatus: "FOUND" | "NOT_FOUND" | "ERROR" = "NOT_FOUND";
    let localFilePath: string | null = null;

    try {
      // Fetch the receipt
      const response = await fetch(receiptUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SomaliaImmigration/1.0)",
        },
      });

      if (response.ok && response.status === 200) {
        // Get the content
        const content = await response.text();

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), "public", "uploads", "receipts");
        
        if (!existsSync(uploadsDir)) {
          await mkdir(uploadsDir, { recursive: true });
        }

        // Generate filename
        const filename = `receipt_${serialNumber}_${Date.now()}.html`;
        const filePath = path.join(uploadsDir, filename);

        // Save to server
        await writeFile(filePath, content, "utf-8");

        downloadStatus = "FOUND";
        localFilePath = `/uploads/receipts/${filename}`;
      }
    } catch (error) {
      console.error("Download error:", error);
      downloadStatus = "ERROR";
    }

    // Save payment check to database
    const paymentCheck = await prisma.paymentCheck.create({
      data: {
        type: "PAYMENT_RECEIPT",
        serialNumber,
        status: downloadStatus,
        resultUrl: localFilePath || receiptUrl,
        checkedBy,
      },
    });

    return NextResponse.json({
      ok: true,
      check: {
        id: paymentCheck.id,
        status: downloadStatus,
        receiptUrl: receiptUrl,
        localPath: localFilePath,
        message:
          downloadStatus === "FOUND"
            ? "Payment receipt downloaded successfully"
            : downloadStatus === "ERROR"
            ? "Error downloading receipt"
            : "Payment receipt not found",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error" },
      { status: 500 }
    );
  }
}
