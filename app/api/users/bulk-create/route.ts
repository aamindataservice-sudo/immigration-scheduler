import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

type Item = {
  fullName?: string;
  phone?: string;
  role?: "ADMIN" | "OFFICER";
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? (body.items as Item[]) : [];
    if (!items.length) {
      return NextResponse.json({ ok: false, error: "Items required" }, { status: 400 });
    }

    const data = [];
    const invalid: Item[] = [];

    for (const raw of items) {
      const phone = normalizePhone(raw.phone ?? "");
      if (!phone) {
        invalid.push(raw);
        continue;
      }
      const role: "ADMIN" | "OFFICER" = raw.role === "ADMIN" ? "ADMIN" : "OFFICER";
      const defaultPassword = role === "ADMIN" ? "admin123" : "officer123";
      const fullName = String(raw.fullName ?? "").trim() || phone;
      data.push({
        fullName,
        phone,
        role,
        passwordHash: hashPassword(defaultPassword),
        mustChangePassword: true,
      });
    }

    let created = 0;
    for (const item of data) {
      try {
        await prisma.user.create({ data: item });
        created++;
      } catch (e: any) {
        if (!e?.message?.includes("UNIQUE constraint")) {
          throw e;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      invalid: invalid.length,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}
