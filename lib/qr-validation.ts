/**
 * Shared QR validation for officer scan (Somali message only).
 * CheckerUI keeps its own logic; this is used only by OfficerScanView.
 */

const ALLOWED_QR_DOMAIN = "https://immigration.etas.gov.so";
const VALID_REF_PREFIX = "17";

export function isAllowedQrLink(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const lower = text.trim().toLowerCase();
  return lower.includes(ALLOWED_QR_DOMAIN) || lower.includes("immigration.etas.gov.so");
}

export function getWrongDomainInfo(text: string): { url: string; wrongPart: string } {
  const u = (text || "").trim() || "(empty)";
  try {
    const url = new URL(u.startsWith("http") ? u : `https://${u}`);
    const host = url.hostname.toLowerCase();
    const isOurs = host === "immigration.etas.gov.so" || url.href.toLowerCase().includes("immigration.etas.gov.so");
    if (isOurs) return { url: url.href, wrongPart: "" };
    return { url: url.href, wrongPart: host };
  } catch {
    return { url: u, wrongPart: u };
  }
}

export function isRefValid(ref: string): boolean {
  if (!ref || ref.length < 10) return false;
  const ten = ref.length > 10 ? ref.slice(-10) : ref;
  return ten.startsWith(VALID_REF_PREFIX);
}

export function extractReferenceFromQrContent(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  try {
    const u = text.trim();
    const vpnfMatch = u.match(/[?&]vpnf=(\d+)/i);
    if (vpnfMatch) {
      const digits = vpnfMatch[1];
      return digits.length > 10 ? digits.slice(-10) : digits;
    }
    const receiptMatch = u.match(/etas\.gov\.so\/receipt\/(\d+)/i) || u.match(/\/receipt\/(\d+)/i);
    if (receiptMatch) return receiptMatch[1].length > 10 ? receiptMatch[1].slice(-10) : receiptMatch[1];
    const digitsOnly = u.replace(/\D/g, "");
    if (digitsOnly.length >= 10) return digitsOnly.slice(-10);
    if (digitsOnly.length >= 6) return digitsOnly;
    return null;
  } catch {
    return null;
  }
}

/** Somali: This visa is a valid visa from Somali immigration. */
export const SOMALI_VALID_VISA = "Visa-gan waa visa sax ah oo ka imaanaysa immigration-ka Soomaaliya.";

/** Somali: This is a fake visa. */
export const SOMALI_FAKE_VISA = "Kani waa visa been ah.";
