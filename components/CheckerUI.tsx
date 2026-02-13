"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

const allowedMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const allowedYears = ["2025", "2026", "2027"];

type View = "menu" | "payment" | "evisa" | "scan" | "penalties";

type PenaltyItem = {
  id: string;
  officerId: string | null;
  stampNo: string;
  note: string | null;
  color: string | null;
  count: number;
  createdAt: string;
  officer: { id: string; fullName: string; role: string } | null;
  createdByUser: { id: string; fullName: string };
};

type PaymentResult = {
  status: "FOUND" | "NOT_FOUND" | "ERROR";
  localPath?: string;
  receiptUrl?: string;
  message: string;
};

type EVisaResult = {
  status: "FOUND" | "NOT_FOUND" | "ERROR";
  visaUrl?: string;
  message: string;
};

type CheckerUIProps = { user: { id: string; fullName?: string }; initialView?: View; hideBackToMenu?: boolean };

const ALLOWED_QR_DOMAIN = "https://immigration.etas.gov.so";
const VALID_REF_PREFIX = "17";

/** Somali: wrong website warning */
const SOMALI_WRONG_WEBSITE = "QR-ku wuxuu tusayaa websaydh kale (ma aha kan immigrationka). Halkan ka eeg link-ka:";
/** Somali: wrong reference (must start with 17) */
const SOMALI_WRONG_REF = "Lambarka referens-ka ma saxna fadlan iska hubi. Halkan ka eeg lambarka:";

/** Only accept QR content when the link includes the allowed immigration e-Visa domain. */
function isAllowedQrLink(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const lower = text.trim().toLowerCase();
  return lower.includes(ALLOWED_QR_DOMAIN) || lower.includes("immigration.etas.gov.so");
}

/** After reading QR content: return { url, wrongPart } when link is not our allowed domain (so we always show what we read). */
function getWrongDomainInfo(text: string): { url: string; wrongPart: string } {
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

/** True if a 10-digit reference is valid (must start with 17). */
function isRefValid(ref: string): boolean {
  if (!ref || ref.length < 10) return false;
  const ten = ref.length > 10 ? ref.slice(-10) : ref;
  return ten.startsWith(VALID_REF_PREFIX);
}

/** Extract 10 digits (reference/serial) from QR content: verifyEvisa URL (?vpnf=...), etas.gov.so link, or any string with digits */
function extractReferenceFromQrContent(text: string): string | null {
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

export default function CheckerUI({ user, initialView, hideBackToMenu = false }: CheckerUIProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingReceiptWindowRef = useRef<Window | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanAnimationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentView, setCurrentView] = useState<View>(initialView ?? "menu");
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [scanError, setScanError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [scanFeedback, setScanFeedback] = useState("");
  const [scanWarning, setScanWarning] = useState<{ type: "wrong_domain"; url: string; wrongPart: string } | { type: "wrong_ref"; ref: string } | null>(null);

  const [serialNumber, setSerialNumber] = useState("");
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  const [passportNumber, setPassportNumber] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [visaYear, setVisaYear] = useState(allowedYears[0]);
  const [visaMonth, setVisaMonth] = useState(allowedMonths[0]);
  const [evisaResult, setEvisaResult] = useState<EVisaResult | null>(null);

  const [myChecks, setMyChecks] = useState<{ type: string; createdAt: string }[]>([]);

  const [officers, setOfficers] = useState<{ id: string; fullName: string; phone: string }[]>([]);
  const [penaltyList, setPenaltyList] = useState<PenaltyItem[]>([]);
  const [penaltyCountTotal, setPenaltyCountTotal] = useState(0);
  const [penaltyOfficerId, setPenaltyOfficerId] = useState("");
  const [penaltyStampNo, setPenaltyStampNo] = useState("");
  const [penaltyNote, setPenaltyNote] = useState("");
  const [penaltyColor, setPenaltyColor] = useState("");
  const [penaltyCount, setPenaltyCount] = useState(0);
  const [penaltyShowAddForm, setPenaltyShowAddForm] = useState(false);
  const [penaltyLayout, setPenaltyLayout] = useState<1 | 2 | 4>(2);
  const [penaltyEditingId, setPenaltyEditingId] = useState<string | null>(null);
  const [penaltyEditStampNo, setPenaltyEditStampNo] = useState("");
  const [penaltyEditNote, setPenaltyEditNote] = useState("");
  const [penaltyEditColor, setPenaltyEditColor] = useState("");
  const [penaltyMenuOpenId, setPenaltyMenuOpenId] = useState<string | null>(null);
  const [penaltyTapFlashId, setPenaltyTapFlashId] = useState<string | null>(null);
  const [penaltyAuditLogs, setPenaltyAuditLogs] = useState<{ id: string; action: string; createdAt: string; actor?: { fullName: string }; metadata?: unknown }[]>([]);
  const [penaltyHistory, setPenaltyHistory] = useState<{ id: string; date: string; count: number; officerPenalty: { id: string; stampNo: string } }[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/payment/my-checks?userId=${user.id}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.checks)) setMyChecks(data.checks);
      })
      .catch(() => {});
    const t = setTimeout(() => {
      fetch(`/api/penalties/count?requesterId=${user.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && typeof data.count === "number") setPenaltyCountTotal(data.count);
        })
        .catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, [user?.id]);

  const todayStart = (() => {
    try {
      const d = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Mogadishu", year: "numeric", month: "2-digit", day: "2-digit" });
      const parts = formatter.formatToParts(d);
      const y = parts.find((p) => p.type === "year")?.value ?? "";
      const m = parts.find((p) => p.type === "month")?.value ?? "";
      const day = parts.find((p) => p.type === "day")?.value ?? "";
      return `${y}-${m}-${day}`;
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  })();

  const isToday = (createdAt: string) => {
    try {
      const d = new Date(createdAt);
      const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Mogadishu", year: "numeric", month: "2-digit", day: "2-digit" });
      const parts = formatter.formatToParts(d);
      const y = parts.find((p) => p.type === "year")?.value ?? "";
      const m = parts.find((p) => p.type === "month")?.value ?? "";
      const day = parts.find((p) => p.type === "day")?.value ?? "";
      return `${y}-${m}-${day}` === todayStart;
    } catch {
      return false;
    }
  };

  const paymentToday = myChecks.filter((c) => c.type === "PAYMENT_RECEIPT" && isToday(c.createdAt)).length;
  const evisaToday = myChecks.filter((c) => c.type === "EVISA" && isToday(c.createdAt)).length;
  const totalToday = paymentToday + evisaToday;

  /** Always open in new tab so receipt/PDF works (mobile and desktop). */
  const openInNewTab = (url: string) => {
    if (!url) return;
    const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  const receiptBaseUrl = "https://etas.gov.so/receipt/";

  useEffect(() => {
    if (currentView !== "scan") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setScanFeedback("Point at a receipt or e-Visa QR code");
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let mounted = true;
    const isMobile = typeof window !== "undefined" && (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    const scanIntervalMs = isMobile ? 350 : 200;
    const maxSize = isMobile ? 320 : 480;

    const stopCamera = () => {
      if (intervalId != null) clearInterval(intervalId);
      intervalId = null;
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      scanAnimationRef.current = null;
    };

    const tick = () => {
      try {
        if (!streamRef.current || !videoRef.current || !canvasRef.current) return;
        const v = videoRef.current;
        const c = canvasRef.current;
        if (v.readyState !== v.HAVE_ENOUGH_DATA || v.videoWidth <= 0) return;
        const w = Math.min(v.videoWidth, maxSize);
        const h = Math.min(v.videoHeight, Math.round((maxSize * v.videoHeight) / v.videoWidth));
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(v, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        let code = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
        if (!code?.data) code = jsQR(imageData.data, w, h, { inversionAttempts: "invertFirst" });
        if (!code?.data) code = jsQR(imageData.data, w, h);
        if (code?.data) {
          const readLink = code.data;
          if (!isAllowedQrLink(readLink)) {
            const wrongInfo = getWrongDomainInfo(readLink);
            if (mounted) {
              setScanWarning({
                type: "wrong_domain",
                url: wrongInfo.url,
                wrongPart: wrongInfo.wrongPart || wrongInfo.url,
              });
              setScanFeedback(SOMALI_WRONG_WEBSITE);
            }
            return;
          }
          setScanWarning(null);
          stopCamera();
          const reference = extractReferenceFromQrContent(readLink);
          if (reference) {
            if (!isRefValid(reference)) {
              if (mounted) {
                setScanWarning({ type: "wrong_ref", ref: reference });
                setScanFeedback(SOMALI_WRONG_REF);
              }
              return;
            }
            setScanWarning(null);
            if (mounted) setScanFeedback("Valid QR! Opening receipt…");
            const receiptUrl = `${receiptBaseUrl}${encodeURIComponent(reference)}`;
            const win = window.open("", "_blank");
            if (win) {
              try {
                win.location.href = receiptUrl;
              } catch (_) {}
            }
            setSerialNumber(reference);
            setCurrentView("payment");
            setPaymentResult(null);
            setMessage("");
            runPaymentCheck(reference);
            return;
          }
          setScanFeedback("QR detected — hold steady (use receipt/e-Visa QR)");
        } else {
          setScanWarning(null);
          setScanFeedback("Point at a receipt or e-Visa QR code");
        }
      } catch (_) {
        setScanFeedback("Point at a receipt or e-Visa QR code");
      }
    };

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "environment",
          width: isMobile ? { ideal: 640 } : { ideal: 1280 },
          height: isMobile ? { ideal: 480 } : { ideal: 720 },
        },
      })
      .then((s) => {
        stream = s;
        streamRef.current = s;
        video.srcObject = s;
        video.setAttribute("playsinline", "true");
        video.setAttribute("muted", "true");
        video.play().then(() => {
          intervalId = setInterval(tick, scanIntervalMs);
          scanAnimationRef.current = intervalId;
        }).catch(() => {
          intervalId = setInterval(tick, scanIntervalMs);
          scanAnimationRef.current = intervalId;
        });
      })
      .catch((err) => {
        setCameraError(err?.message || "Camera access denied.");
      });

    return () => {
      mounted = false;
      stopCamera();
      if (video.srcObject) {
        video.srcObject = null;
      }
      setScanFeedback("");
      setScanWarning(null);
    };
  }, [currentView]);

  const runPaymentCheck = async (serial: string) => {
    if (!user?.id) {
      setMessage("Session expired. Please login again.");
      return;
    }
    setMessage("");
    setPaymentResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payment/download-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber: serial, checkedBy: user.id }),
      });
      const data = await res.json();
      if (data.ok) {
        const check = data.check;
        setPaymentResult({
          status: check.status,
          localPath: check.localPath,
          receiptUrl: check.receiptUrl,
          message: check.message,
        });
        setMessage(check.status === "FOUND" ? `✅ ${check.message}` : check.status === "NOT_FOUND" ? `❌ ${check.message}` : `⚠️ ${check.message}`);
        setSerialNumber("");
        fetch(`/api/payment/my-checks?userId=${user.id}&limit=200`).then((r) => r.json()).then((d) => { if (d.ok && Array.isArray(d.checks)) setMyChecks(d.checks); });
      } else {
        setMessage(`❌ ${data.error || "Failed to check payment"}`);
      }
    } catch (err: unknown) {
      setMessage(`❌ ${err instanceof Error ? err.message : "Error checking payment"}`);
    } finally {
      setLoading(false);
    }
  };

  const checkPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    openInNewTab(`${receiptBaseUrl}${encodeURIComponent(serialNumber)}`);
    await runPaymentCheck(serialNumber);
  };

  const checkEvisa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setMessage("Session expired. Please login again.");
      return;
    }
    setMessage("");
    setEvisaResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payment/check-evisa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passportNumber: passportNumber.trim(),
          referenceNumber: referenceNumber.trim(),
          visaYear,
          visaMonth,
          checkedBy: user.id,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const check = data.check;
        setEvisaResult({
          status: check.status,
          visaUrl: check.visaUrl,
          message: check.message,
        });
        setMessage(check.status === "FOUND" ? `✅ ${check.message}` : check.status === "ERROR" ? `⚠️ ${check.message}` : `❌ ${check.message}`);
        fetch(`/api/payment/my-checks?userId=${user.id}&limit=200`).then((r) => r.json()).then((d) => { if (d.ok && Array.isArray(d.checks)) setMyChecks(d.checks); });
      } else {
        setMessage(`❌ ${data.error || "Failed to check e-Visa"}`);
      }
    } catch (err: unknown) {
      setMessage(`❌ ${err instanceof Error ? err.message : "Error checking e-Visa"}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadEvisa = () => {
    if (evisaResult?.visaUrl) {
      openInNewTab(evisaResult.visaUrl);
      setMessage("✅ Opening e-Visa PDF...");
    }
  };

  const loadOfficers = () => {
    if (!user?.id) return;
    fetch(`/api/penalties/officers?requesterId=${user.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok && Array.isArray(d.officers)) setOfficers(d.officers); });
  };

  const loadPenalties = () => {
    if (!user?.id) return;
    fetch(`/api/penalties?requesterId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.list)) {
          setPenaltyList(d.list);
          setPenaltyCountTotal(d.list.length);
          loadPenaltyHistory();
        }
      });
  };

  const loadPenaltyAudit = () => {
    if (!user?.id) return;
    fetch(`/api/penalties/audit?requesterId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.logs)) setPenaltyAuditLogs(d.logs);
      });
  };

  const loadPenaltyHistory = () => {
    if (!user?.id) return;
    fetch(`/api/penalties/history?requesterId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.snapshots)) setPenaltyHistory(d.snapshots);
      });
  };

  useEffect(() => {
    if (currentView === "penalties") {
      loadOfficers();
      loadPenalties();
      loadPenaltyAudit();
    }
  }, [currentView, user?.id]);

  const createPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/penalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: user.id,
          officerId: penaltyOfficerId || undefined,
          stampNo: penaltyStampNo,
          note: penaltyNote || undefined,
          color: penaltyColor || undefined,
          count: penaltyCount,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("✅ Stamp added");
        setPenaltyOfficerId("");
        setPenaltyStampNo("");
        setPenaltyNote("");
        setPenaltyColor("");
        setPenaltyCount(0);
        setPenaltyShowAddForm(false);
        loadPenalties();
        loadPenaltyAudit();
      } else {
        setMessage("❌ " + (data.error || "Failed"));
      }
    } catch (err: unknown) {
      setMessage("❌ " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setLoading(false);
    }
  };

  const updatePenaltyCount = async (id: string, delta: number) => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/penalties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: user.id, countDelta: delta }),
      });
      const data = await res.json();
      if (data.ok) {
        loadPenalties();
        loadPenaltyAudit();
      } else setMessage("❌ " + (data.error || "Failed"));
    } catch (err: unknown) {
      setMessage("❌ " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const savePenaltyEdit = async () => {
    if (!user?.id || !penaltyEditingId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/penalties/${penaltyEditingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: user.id,
          stampNo: penaltyEditStampNo,
          note: penaltyEditNote,
          color: penaltyEditColor || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("✅ Updated");
        setPenaltyEditingId(null);
        setPenaltyMenuOpenId(null);
        loadPenalties();
        loadPenaltyAudit();
      } else setMessage("❌ " + (data.error || "Failed"));
    } catch (err: unknown) {
      setMessage("❌ " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setLoading(false);
    }
  };

  const deletePenalty = async (id: string) => {
    if (!user?.id || !confirm("Delete this stamp?")) return;
    try {
      const res = await fetch(`/api/penalties/${id}?requesterId=${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setMessage("✅ Deleted");
        setPenaltyMenuOpenId(null);
        loadPenalties();
        loadPenaltyAudit();
      } else setMessage("❌ " + (data.error || "Failed"));
    } catch (err: unknown) {
      setMessage("❌ " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const clearPenaltyAudit = async () => {
    if (!user?.id || !confirm("Clear all penalty audit history? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/penalties/audit?requesterId=${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setMessage("✅ Audit history cleared");
        setPenaltyAuditLogs([]);
      } else setMessage("❌ " + (data.error || "Failed"));
    } catch (err: unknown) {
      setMessage("❌ " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const logout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  const handleScanClick = () => {
    setScanError("");
    fileInputRef.current?.click();
  };

  const tryDecodeQr = (imageData: ImageData, opts?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" }) => {
    return jsQR(imageData.data, imageData.width, imageData.height, opts);
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setScanError("Please use an image file.");
      return;
    }
    setScanError("");
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) {
        setScanError("Could not read image.");
        return;
      }
      const sizes = [
        { width: w, height: h },
        ...(w > 800 || h > 800 ? [{ width: 800, height: Math.round((800 / w) * h) }, { width: Math.round((800 / h) * w), height: 800 }] : []),
        ...(w < 400 && h < 400 ? [{ width: Math.min(800, w * 2), height: Math.min(800, h * 2) }] : []),
      ];
      let code: ReturnType<typeof jsQR> = null;
      for (const size of sizes) {
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const c = canvas.getContext("2d");
        if (!c) continue;
        c.drawImage(img, 0, 0, size.width, size.height);
        const imageData = c.getImageData(0, 0, size.width, size.height);
        code = tryDecodeQr(imageData, { inversionAttempts: "attemptBoth" });
        if (code?.data) break;
        code = tryDecodeQr(imageData, { inversionAttempts: "invertFirst" });
        if (code?.data) break;
        code = tryDecodeQr(imageData);
        if (code?.data) break;
      }
      if (!code?.data) {
        setScanError("No QR code found. Try a clearer image.");
        if (pendingReceiptWindowRef.current) {
          try {
            pendingReceiptWindowRef.current.close();
          } catch (_) {}
          pendingReceiptWindowRef.current = null;
        }
        return;
      }
      if (!isAllowedQrLink(code.data)) {
        const wrongInfo = getWrongDomainInfo(code.data);
        setScanWarning({
          type: "wrong_domain",
          url: wrongInfo.url,
          wrongPart: wrongInfo.wrongPart || wrongInfo.url,
        });
        setScanError("");
        if (pendingReceiptWindowRef.current) {
          try {
            pendingReceiptWindowRef.current.close();
          } catch (_) {}
          pendingReceiptWindowRef.current = null;
        }
        return;
      }
      const reference = extractReferenceFromQrContent(code.data);
      if (!reference) {
        setScanWarning(null);
        setScanError("QR content not recognized.");
        if (pendingReceiptWindowRef.current) {
          try {
            pendingReceiptWindowRef.current.close();
          } catch (_) {}
          pendingReceiptWindowRef.current = null;
        }
        return;
      }
      if (!isRefValid(reference)) {
        setScanWarning({ type: "wrong_ref", ref: reference });
        setScanError("");
        if (pendingReceiptWindowRef.current) {
          try {
            pendingReceiptWindowRef.current.close();
          } catch (_) {}
          pendingReceiptWindowRef.current = null;
        }
        return;
      }
      setScanWarning(null);
      if (pendingReceiptWindowRef.current) {
        try {
          pendingReceiptWindowRef.current.location.href = `${receiptBaseUrl}${encodeURIComponent(reference)}`;
        } catch (_) {}
        pendingReceiptWindowRef.current = null;
      }
      setSerialNumber(reference);
      setCurrentView("payment");
      setPaymentResult(null);
      setMessage("");
      runPaymentCheck(reference);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setScanError("Could not load image.");
      if (pendingReceiptWindowRef.current) {
        try {
          pendingReceiptWindowRef.current.close();
        } catch (_) {}
        pendingReceiptWindowRef.current = null;
      }
    };
    img.src = url;
  };

  const handleScanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      pendingReceiptWindowRef.current = window.open("", "_blank");
      processImageFile(file);
    }
  };

  return (
    <div className="checker-page">
      <header className="checker-header">
        <div className="checker-brand">
          <img src="/logo.svg" alt="" className="checker-logo-img" aria-hidden />
          <div className="checker-header-inner">
            <h1 className="checker-title">International Arrival</h1>
            <span className="checker-subtitle">Payment & visa verification</span>
          </div>
        </div>
        <div className="checker-header-right">
          <div className="checker-profile-wrap">
            <button
              type="button"
              className="checker-profile-btn"
              onClick={() => setProfileOpen((o) => !o)}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              aria-label="Profile menu"
            >
              <span className="checker-profile-avatar">{(user?.fullName || "U").charAt(0).toUpperCase()}</span>
            </button>
            {profileOpen && (
              <>
                <div className="checker-profile-backdrop" onClick={() => setProfileOpen(false)} aria-hidden />
                <div className="checker-profile-dropdown">
                  <div className="checker-profile-head">
                    <span className="checker-profile-name">{user?.fullName || "User"}</span>
                    <span className="checker-profile-role">Checker</span>
                  </div>
                  <a href="/change-password" className="checker-profile-item" onClick={() => setProfileOpen(false)}>
                    Change password
                  </a>
                  <button type="button" className="checker-profile-item checker-profile-logout" onClick={() => { setProfileOpen(false); logout(); }}>
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {message && (
        <div className="checker-toast" onClick={() => setMessage("")} role="alert">
          {message}
        </div>
      )}

      <main className="checker-main">
        {currentView === "menu" && (
          <section className="checker-menu">
            <div className="checker-welcome-banner">
              <span className="checker-welcome-banner-text">Welcome back, <strong>{user?.fullName || "User"}</strong></span>
            </div>
            <p className="checker-menu-subtitle">Choose an option</p>
            <div className="checker-menu-buttons">
              <button type="button" className="checker-menu-btn checker-menu-btn-1 checker-card-anim" onClick={() => setCurrentView("payment")}>
                <span className="checker-menu-icon">💳</span>
                <span className="checker-menu-btn-label">Check Payment</span>
                <span className="checker-menu-btn-desc">View receipt</span>
                <span className="checker-menu-today">{paymentToday} today</span>
              </button>
              <button type="button" className="checker-menu-btn checker-menu-btn-3 checker-card-anim checker-card-delay-1" onClick={() => { setScanError(""); setCameraError(""); setCurrentView("scan"); }}>
                <span className="checker-menu-icon">📷</span>
                <span className="checker-menu-btn-label">Scan me</span>
                <span className="checker-menu-btn-desc">Scan QR code</span>
                <span className="checker-menu-today">{totalToday} total today</span>
              </button>
              <button type="button" className="checker-menu-btn checker-menu-btn-4 checker-card-anim checker-card-delay-2" onClick={() => setCurrentView("penalties")}>
                <span className="checker-menu-icon">📋</span>
                <span className="checker-menu-btn-label">Officer penalties</span>
                <span className="checker-menu-btn-desc">Stamps & count</span>
                <span className="checker-menu-today">{penaltyCountTotal} stamps</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="checker-scan-input"
              onChange={handleScanFile}
              aria-hidden="true"
              tabIndex={-1}
            />
          </section>
        )}

        {currentView === "payment" && (
          <section className="checker-view checker-view-enter">
            <div className="checker-view-header">
              {!hideBackToMenu && (
              <button type="button" className="checker-back" onClick={() => { setCurrentView("menu"); setMessage(""); setPaymentResult(null); }} aria-label="Back">
                <span className="checker-back-arrow" aria-hidden>←</span>
                Back
              </button>
              )}
              <div className="checker-view-heading">
                <h2 className="checker-view-title">Payment receipt</h2>
                <p className="checker-view-sub">Open your official payment receipt</p>
              </div>
            </div>
            <div className="checker-card">
              <div className="checker-card-header">
                <div className="checker-card-title">Payment</div>
                <span className="checker-chip">Receipt</span>
              </div>
              <form onSubmit={checkPayment}>
                <label className="checker-label" htmlFor="serial">Serial number</label>
                <div className="checker-field-row">
                  <input
                    id="serial"
                    type="text"
                    className="checker-input"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="e.g. 1763816489"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                  />
                  <button type="submit" className="checker-btn-primary" disabled={loading}>
                    {loading ? "Checking…" : "Search"}
                  </button>
                </div>
                {paymentResult?.status === "FOUND" && paymentResult.localPath && (
                  <div className="checker-alert success">
                    <span>✅</span>
                    <span>Receipt found. You can view it in the opened tab or click below.</span>
                    <button type="button" className="checker-btn-secondary" onClick={() => openInNewTab(paymentResult.localPath!)}>
                      View receipt
                    </button>
                  </div>
                )}
                {paymentResult?.status === "NOT_FOUND" && (
                  <div className="checker-alert error">
                    <span>❌</span>
                    <span>Payment receipt not found. You can try opening the receipt link in a new tab.</span>
                    <button type="button" className="checker-btn-secondary" onClick={() => openInNewTab(paymentResult?.receiptUrl || `https://etas.gov.so/receipt/${serialNumber}`)}>
                      Open receipt in new tab
                    </button>
                  </div>
                )}
                {paymentResult?.status === "ERROR" && (
                  <div className="checker-alert error">
                    <span>⚠️</span>
                    <span>Error downloading receipt. You can try opening the receipt link in a new tab.</span>
                    <button type="button" className="checker-btn-secondary" onClick={() => openInNewTab(paymentResult?.receiptUrl || `https://etas.gov.so/receipt/${serialNumber}`)}>
                      Open receipt in new tab
                    </button>
                  </div>
                )}
              </form>
            </div>
          </section>
        )}

        {currentView === "evisa" && (
          <section className="checker-view checker-view-enter">
            <div className="checker-view-header">
              {!hideBackToMenu && (
              <button type="button" className="checker-back" onClick={() => { setCurrentView("menu"); setMessage(""); setEvisaResult(null); }} aria-label="Back">
                <span className="checker-back-arrow" aria-hidden>←</span>
                Back
              </button>
              )}
              <div className="checker-view-heading">
                <h2 className="checker-view-title">E-Visa download</h2>
                <p className="checker-view-sub">Check if your visa is ready and download</p>
              </div>
            </div>
            <div className="checker-card">
              <div className="checker-card-header">
                <div className="checker-card-title">E-Visa</div>
                <span className="checker-chip">Status</span>
              </div>
              <form onSubmit={checkEvisa}>
                <label className="checker-label" htmlFor="passport">Passport number</label>
                <input
                  id="passport"
                  type="text"
                  className="checker-input checker-input-full"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. NXBRJ51J6"
                  required
                />
                <label className="checker-label" htmlFor="reference">Reference number</label>
                <input
                  id="reference"
                  type="text"
                  className="checker-input checker-input-full"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. 1764136564"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                />
                <label className="checker-label">Visa application date</label>
                <div className="checker-field-row">
                  <select className="checker-select" value={visaMonth} onChange={(e) => setVisaMonth(e.target.value)} required>
                    {allowedMonths.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select className="checker-select" value={visaYear} onChange={(e) => setVisaYear(e.target.value)} required>
                    {allowedYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="checker-field-row checker-actions">
                  <button type="submit" className="checker-btn-primary" disabled={loading}>
                    {loading ? "Checking…" : "Search visa"}
                  </button>
                  {evisaResult?.status === "FOUND" && evisaResult.visaUrl && (
                    <button type="button" className="checker-btn-primary" onClick={downloadEvisa}>
                      Download e-Visa (PDF)
                    </button>
                  )}
                </div>
                {evisaResult?.status === "FOUND" && evisaResult.visaUrl && (
                  <div className="checker-alert success">
                    <span>✅</span>
                    <span>Your visa is ready. You can download it above.</span>
                  </div>
                )}
                {evisaResult?.status === "NOT_FOUND" && (
                  <div className="checker-alert error">
                    <span>ℹ️</span>
                    <span>Your visa is not ready yet. Please wait or contact support.</span>
                  </div>
                )}
                {evisaResult?.status === "ERROR" && (
                  <div className="checker-alert error">
                    <span>⚠️</span>
                    <span>Error checking e-Visa. Please try again.</span>
                  </div>
                )}
              </form>
            </div>
          </section>
        )}

        {currentView === "scan" && (
          <section className="checker-view checker-scan-view checker-view-enter">
            <div className="checker-view-header">
              {!hideBackToMenu && (
              <button
                type="button"
                className="checker-back"
                aria-label="Back"
                onClick={() => {
                  streamRef.current?.getTracks().forEach((t) => t.stop());
                  streamRef.current = null;
                  if (scanAnimationRef.current != null) clearInterval(scanAnimationRef.current);
                  scanAnimationRef.current = null;
                  if (videoRef.current?.srcObject) {
                    videoRef.current.srcObject = null;
                  }
                  setCurrentView("menu");
                  setCameraError("");
                  setScanWarning(null);
                  setScanError("");
                }}
              >
                <span className="checker-back-arrow" aria-hidden>←</span>
                Back
              </button>
              )}
              <div className="checker-view-heading">
                <h2 className="checker-view-title">Scan QR code</h2>
                <p className="checker-view-sub">Point camera at QR code — auto-detect. Only QR codes from https://immigration.etas.gov.so</p>
              </div>
            </div>
            <div className="checker-scan-camera-wrap">
              <video
                ref={videoRef}
                className="checker-scan-video"
                playsInline
                muted
                autoPlay
              />
              <canvas ref={canvasRef} className="checker-scan-canvas" aria-hidden />
              <div className="checker-scan-overlay">
                <div className="checker-scan-frame" />
                <p className="checker-scan-hint">{scanFeedback || "Point at a receipt or e-Visa QR code"}</p>
              </div>
            </div>
            {scanWarning?.type === "wrong_domain" && (
              <div className="checker-fake-alert-overlay" role="alertdialog" aria-modal="true" aria-labelledby="checker-fake-alert-title">
                <div className="checker-fake-alert-popup">
                  <div className="checker-fake-alert-icon">⚠️</div>
                  <h2 id="checker-fake-alert-title" className="checker-fake-alert-title">Fake visa detection</h2>
                  <p className="checker-fake-alert-subtitle">Wrong website — not official immigration e-Visa</p>
                  <p className="checker-fake-alert-msg">{SOMALI_WRONG_WEBSITE}</p>
                  <p className="checker-qr-label">Link read from QR:</p>
                  <p className="checker-qr-url">
                    {scanWarning.wrongPart && scanWarning.url.indexOf(scanWarning.wrongPart) >= 0 ? (
                      <>
                        {scanWarning.url.slice(0, scanWarning.url.indexOf(scanWarning.wrongPart))}
                        <span className="checker-qr-wrong-part">{scanWarning.wrongPart}</span>
                        {scanWarning.url.slice(scanWarning.url.indexOf(scanWarning.wrongPart) + scanWarning.wrongPart.length)}
                      </>
                    ) : (
                      scanWarning.url
                    )}
                  </p>
                  <button
                    type="button"
                    className="checker-fake-alert-btn"
                    onClick={() => setScanWarning(null)}
                    autoFocus
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
            {scanWarning?.type === "wrong_ref" && (
              <div className="checker-scan-warning" role="alert">
                <p className="checker-scan-warning-msg">{SOMALI_WRONG_REF}</p>
                <p className="checker-qr-label">Reference read from QR:</p>
                <p className="checker-qr-ref">
                  <span className="checker-qr-wrong-part">{scanWarning.ref}</span>
                </p>
              </div>
            )}
            {scanError && !scanWarning && (
              <div className="checker-alert error" style={{ marginTop: 12 }}>
                <span>⚠️</span>
                <span>{scanError}</span>
              </div>
            )}
            {cameraError && (
              <div className="checker-alert error" style={{ marginTop: 12 }}>
                <span>⚠️</span>
                <span>{cameraError}</span>
              </div>
            )}
          </section>
        )}

        {currentView === "penalties" && (
          <section className="checker-view checker-view-enter checker-penalties-view">
            <div className="checker-view-header">
              {!hideBackToMenu && (
                <button type="button" className="checker-back" onClick={() => { setCurrentView("menu"); setMessage(""); setPenaltyEditingId(null); setPenaltyShowAddForm(false); setPenaltyMenuOpenId(null); }} aria-label="Back">
                  <span className="checker-back-arrow" aria-hidden>←</span>
                  Back
                </button>
              )}
              <div className="checker-view-heading">
                <h2 className="checker-view-title">Officer penalties</h2>
                <p className="checker-view-sub">Stamps & count</p>
              </div>
            </div>

            <div className="checker-penalty-toolbar">
              <button type="button" className="checker-btn-add-counter" onClick={() => setPenaltyShowAddForm(!penaltyShowAddForm)}>
                + Add Counter
              </button>
              <div className="checker-penalty-layout">
                {([1, 2, 4] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={"checker-layout-btn" + (penaltyLayout === n ? " active" : "")}
                    onClick={() => setPenaltyLayout(n)}
                    aria-label={`${n} per row`}
                    title={`${n} per row`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {penaltyShowAddForm && (
              <div className="checker-card checker-penalty-form-card">
                <div className="checker-card-header">
                  <div className="checker-card-title">New stamp</div>
                  <button type="button" className="checker-btn-secondary checker-btn-sm" onClick={() => setPenaltyShowAddForm(false)}>Cancel</button>
                </div>
                <form onSubmit={createPenalty} className="checker-form-stack">
                  <label className="checker-label" htmlFor="penalty-officer">Officer (optional)</label>
                  <select
                    id="penalty-officer"
                    className="checker-input"
                    value={penaltyOfficerId}
                    onChange={(e) => setPenaltyOfficerId(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {officers.map((o) => (
                      <option key={o.id} value={o.id}>{o.fullName}</option>
                    ))}
                  </select>
                  <label className="checker-label" htmlFor="penalty-stamp">Stamp no</label>
                  <input
                    id="penalty-stamp"
                    type="text"
                    className="checker-input"
                    value={penaltyStampNo}
                    onChange={(e) => setPenaltyStampNo(e.target.value)}
                    placeholder="Stamp number"
                    required
                  />
                  <label className="checker-label" htmlFor="penalty-color">Card color (optional, auto if empty)</label>
                  <input
                    id="penalty-color"
                    type="text"
                    className="checker-input"
                    value={penaltyColor}
                    onChange={(e) => setPenaltyColor(e.target.value)}
                    placeholder="e.g. #0f766e or leave empty"
                  />
                  <label className="checker-label" htmlFor="penalty-note">Note (optional)</label>
                  <input
                    id="penalty-note"
                    type="text"
                    className="checker-input"
                    value={penaltyNote}
                    onChange={(e) => setPenaltyNote(e.target.value)}
                    placeholder="Optional note"
                  />
                  <label className="checker-label" htmlFor="penalty-count">Initial count</label>
                  <input
                    id="penalty-count"
                    type="number"
                    className="checker-input"
                    min={0}
                    value={penaltyCount}
                    onChange={(e) => setPenaltyCount(parseInt(e.target.value, 10) || 0)}
                  />
                  <button type="submit" className="checker-btn-primary" disabled={loading}>
                    {loading ? "Adding…" : "Add stamp"}
                  </button>
                </form>
              </div>
            )}

            {penaltyList.length === 0 ? (
              <p className="checker-view-sub checker-penalty-empty">No stamps yet. Click &quot;+ Add Counter&quot; to add one.</p>
            ) : (
              <div className={`checker-penalty-grid penalty-cols-${penaltyLayout}`}>
                {[...penaltyList]
                  .sort((a, b) => b.count - a.count)
                  .map((p) => (
                  <div
                    key={p.id}
                    className={`checker-penalty-counter-card ${penaltyTapFlashId === p.id ? "penalty-tap-flash" : ""}`}
                    style={{ "--penalty-color": p.color || "#6b21a8" } as React.CSSProperties}
                  >
                    <div className="checker-penalty-card-header">
                      <span className="checker-penalty-card-icon">📋</span>
                      <span className="checker-penalty-card-title">{p.stampNo}</span>
                      <div className="checker-penalty-card-menu" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="checker-penalty-dots"
                          onClick={(e) => { e.stopPropagation(); setPenaltyMenuOpenId(penaltyMenuOpenId === p.id ? null : p.id); }}
                          aria-label="Actions"
                          aria-expanded={penaltyMenuOpenId === p.id}
                        >
                          ⋮
                        </button>
                        {penaltyMenuOpenId === p.id && (
                          <>
                            <div className="checker-penalty-menu-backdrop" onClick={() => setPenaltyMenuOpenId(null)} aria-hidden />
                            <div className="checker-penalty-menu-dropdown">
                              <button type="button" onClick={() => { setPenaltyEditingId(p.id); setPenaltyEditStampNo(p.stampNo); setPenaltyEditNote(p.note ?? ""); setPenaltyEditColor(p.color ?? ""); setPenaltyMenuOpenId(null); }}>Edit</button>
                              <button type="button" onClick={() => { updatePenaltyCount(p.id, -1); setPenaltyMenuOpenId(null); }}>Decrease</button>
                              <button type="button" onClick={() => { deletePenalty(p.id); setPenaltyMenuOpenId(null); }}>Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {penaltyEditingId === p.id ? (
                      <div className="checker-penalty-edit-inline" onClick={(e) => e.stopPropagation()}>
                        <input type="text" className="checker-input checker-input-sm" value={penaltyEditStampNo} onChange={(e) => setPenaltyEditStampNo(e.target.value)} placeholder="Stamp no" />
                        <input type="text" className="checker-input checker-input-sm" value={penaltyEditNote} onChange={(e) => setPenaltyEditNote(e.target.value)} placeholder="Note" />
                        <input type="text" className="checker-input checker-input-sm" value={penaltyEditColor} onChange={(e) => setPenaltyEditColor(e.target.value)} placeholder="Color #hex" />
                        <div className="checker-penalty-edit-actions">
                          <button type="button" className="checker-btn-secondary checker-btn-sm" onClick={savePenaltyEdit}>Save</button>
                          <button type="button" className="checker-btn-secondary checker-btn-sm" onClick={() => setPenaltyEditingId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="checker-penalty-tap-area"
                        onClick={(e) => {
                          e.stopPropagation();
                          updatePenaltyCount(p.id, 1);
                          setPenaltyTapFlashId(p.id);
                          setTimeout(() => setPenaltyTapFlashId(null), 400);
                        }}
                        aria-label="Tap to add one to count"
                      >
                        <div className="checker-penalty-circle-wrap">
                          <div className="checker-penalty-circle">
                            <span className="checker-penalty-circle-count">{p.count}</span>
                          </div>
                        </div>
                        <span className="checker-penalty-tap-hint">Tap card to +1</span>
                        {p.note && <p className="checker-penalty-card-note">{p.note}</p>}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="checker-card checker-penalty-history-card">
              <div className="checker-card-header">
                <div className="checker-card-title">Previous history (daily)</div>
                <button type="button" className="checker-btn-secondary checker-btn-sm" onClick={() => { loadPenaltyHistory(); }}>Refresh</button>
              </div>
              {penaltyHistory.length === 0 ? (
                <p className="checker-view-sub">No previous days yet. Counts reset each day.</p>
              ) : (
                <ul className="checker-audit-list checker-history-list">
                  {penaltyHistory.map((s) => (
                    <li key={s.id} className="checker-audit-item">
                      <span className="checker-audit-action">{s.officerPenalty?.stampNo ?? "—"}</span>
                      <span className="checker-audit-actor">{s.date}</span>
                      <span className="checker-penalty-count-badge">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="checker-card checker-penalty-audit-card">
              <div className="checker-card-header">
                <div className="checker-card-title">Audit history</div>
                <div className="checker-penalty-audit-actions">
                  <button type="button" className="checker-btn-secondary checker-btn-sm" onClick={loadPenaltyAudit}>Refresh</button>
                  <button type="button" className="checker-btn-secondary checker-btn-sm" onClick={clearPenaltyAudit}>Clear all history</button>
                </div>
              </div>
              {penaltyAuditLogs.length === 0 ? (
                <p className="checker-view-sub">No penalty actions yet.</p>
              ) : (
                <ul className="checker-audit-list">
                  {penaltyAuditLogs.map((log) => (
                    <li key={log.id} className="checker-audit-item">
                      <span className="checker-audit-action">{log.action}</span>
                      <span className="checker-audit-actor">{log.actor?.fullName ?? "—"}</span>
                      <span className="checker-audit-time">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</span>
                      {log.metadata != null && typeof log.metadata === "object" && (
                        <span className="checker-audit-meta">{JSON.stringify(log.metadata)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>

      <style jsx>{`
        @keyframes checkerFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkerToastIn {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes checkerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes checkerShine {
          to { background-position: 200% center; }
        }
        @keyframes checkerFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes checkerCardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .checker-card-anim {
          animation: checkerCardIn 0.55s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
          opacity: 0;
        }
        .checker-card-delay-1 { animation-delay: 0.12s; }
        .checker-card-delay-2 { animation-delay: 0.24s; }
        .checker-card-delay-3 { animation-delay: 0.36s; }
        .checker-menu-today {
          display: inline-block;
          margin-top: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.25);
          color: rgba(255, 255, 255, 0.95);
        }
        .checker-page {
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          max-width: 100vw;
          overflow-x: hidden;
          box-sizing: border-box;
          padding: clamp(8px, 3vw, 24px);
          padding-bottom: clamp(20px, 6vw, 48px);
          background: linear-gradient(165deg, #ecfeff 0%, #f0fdfa 25%, #e0f2fe 50%, #f8fafc 85%);
          background-attachment: scroll;
          -webkit-overflow-scrolling: touch;
        }
        .checker-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: clamp(16px, 4vw, 24px);
          animation: checkerFadeUp 0.4s ease-out;
        }
        .checker-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .checker-logo-img {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          flex-shrink: 0;
          object-fit: contain;
        }
        .checker-header-inner {
          min-width: 0;
        }
        .checker-title {
          margin: 0;
          font-size: clamp(1.25rem, 4.5vw, 1.6rem);
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .checker-subtitle {
          display: block;
          margin-top: 2px;
          font-size: clamp(0.8rem, 2.5vw, 0.9rem);
          color: #64748b;
        }
        .checker-header-right {
          display: flex;
          align-items: center;
        }
        .checker-profile-wrap {
          position: relative;
        }
        .checker-profile-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 2px solid rgba(15, 118, 110, 0.35);
          background: linear-gradient(145deg, #0f766e, #14b8a6);
          color: #fff;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
          -webkit-tap-highlight-color: transparent;
        }
        .checker-profile-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 16px rgba(15, 118, 110, 0.4);
        }
        .checker-profile-avatar { line-height: 1; }
        .checker-profile-backdrop {
          position: fixed;
          inset: 0;
          z-index: 98;
          background: transparent;
        }
        .checker-profile-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 200px;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.15);
          border: 1px solid #e2e8f0;
          z-index: 99;
          overflow: hidden;
          animation: checkerDropdownIn 0.2s ease-out;
        }
        @keyframes checkerDropdownIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .checker-profile-head {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
        }
        .checker-profile-name {
          display: block;
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
        }
        .checker-profile-role {
          display: block;
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 2px;
        }
        .checker-profile-item {
          display: block;
          width: 100%;
          padding: 12px 16px;
          text-align: left;
          font-size: 0.9rem;
          font-weight: 500;
          color: #475569;
          text-decoration: none;
          border: none;
          background: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .checker-profile-item:hover {
          background: #f8fafc;
          color: #0f172a;
        }
        .checker-profile-logout { color: #dc2626; }
        .checker-profile-logout:hover {
          background: #fef2f2;
          color: #b91c1c;
        }
        .checker-toast {
          position: fixed;
          top: max(16px, env(safe-area-inset-top));
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 20px;
          background: #0f172a;
          color: #fff;
          border-radius: 14px;
          font-size: 0.9rem;
          max-width: min(90vw, 360px);
          z-index: 100;
          cursor: pointer;
          box-shadow: 0 10px 40px rgba(15, 23, 42, 0.25);
          animation: checkerToastIn 0.3s ease-out;
        }
        .checker-main {
          width: 100%;
          max-width: min(560px, calc(100vw - 20px));
          margin: 0 auto;
          box-sizing: border-box;
          background: #fff;
          border-radius: 24px;
          padding: clamp(18px, 4vw, 28px);
          box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.05);
          animation: checkerMainIn 0.5s cubic-bezier(0.34, 1.2, 0.64, 1);
        }
        @keyframes checkerMainIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .checker-menu {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 24px;
          padding: 8px 0;
        }
        .checker-welcome-banner {
          padding: 14px 18px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(15, 118, 110, 0.1) 0%, rgba(20, 184, 166, 0.08) 100%);
          border: 1px solid rgba(15, 118, 110, 0.18);
          animation: checkerBannerIn 0.4s ease-out;
        }
        @keyframes checkerBannerIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .checker-welcome-banner-text {
          font-size: 0.95rem;
          color: #475569;
        }
        .checker-welcome-banner-text strong {
          color: #0f172a;
          font-weight: 700;
        }
        .checker-menu-subtitle {
          font-size: clamp(0.9rem, 2.5vw, 1rem);
          color: #64748b;
          text-align: center;
          margin: 0;
          animation: checkerFadeUp 0.4s ease-out 0.35s forwards;
          opacity: 0;
        }
        .checker-menu-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          width: 100%;
        }
        @media (min-width: 520px) {
          .checker-menu-buttons {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (min-width: 720px) {
          .checker-menu-buttons {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .checker-menu-btn {
          padding: clamp(14px, 3vw, 22px) 12px;
          border-radius: 18px;
          border: none;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          text-align: center;
          transition: transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1), box-shadow 0.25s ease, filter 0.2s;
          min-height: 114px;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          position: relative;
          overflow: hidden;
        }
        .checker-menu-btn::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.25s;
        }
        .checker-menu-btn:hover {
          transform: translateY(-8px) scale(1.03);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }
        .checker-menu-btn:hover::after {
          opacity: 1;
        }
        .checker-menu-btn:active {
          transform: translateY(-3px) scale(1.01);
        }
        .checker-menu-btn-1 {
          background: linear-gradient(145deg, #0f766e, #0d9488);
          color: #fff;
          box-shadow: 0 8px 24px rgba(15, 118, 110, 0.35);
        }
        .checker-menu-btn-1:hover {
          box-shadow: 0 16px 36px rgba(15, 118, 110, 0.45);
        }
        .checker-menu-btn-2 {
          background: linear-gradient(145deg, #0369a1, #0284c7);
          color: #fff;
          box-shadow: 0 8px 24px rgba(3, 105, 161, 0.35);
        }
        .checker-menu-btn-2:hover {
          box-shadow: 0 16px 36px rgba(3, 105, 161, 0.45);
        }
        .checker-menu-btn-3 {
          background: linear-gradient(145deg, #b45309, #d97706);
          color: #fff;
          box-shadow: 0 8px 24px rgba(180, 83, 9, 0.35);
        }
        .checker-menu-btn-3:hover {
          box-shadow: 0 16px 36px rgba(180, 83, 9, 0.45);
        }
        .checker-menu-btn-4 {
          background: linear-gradient(145deg, #6b21a8, #7c3aed);
          color: #fff;
          box-shadow: 0 8px 24px rgba(107, 33, 168, 0.35);
        }
        .checker-menu-btn-4:hover {
          box-shadow: 0 16px 36px rgba(107, 33, 168, 0.45);
        }
        .checker-menu-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
        }
        .checker-menu-btn-label {
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .checker-menu-btn-desc {
          font-size: 0.8rem;
          font-weight: 500;
          opacity: 0.9;
        }
        .checker-scan-input {
          position: absolute;
          width: 0;
          height: 0;
          opacity: 0;
          pointer-events: none;
        }
        .checker-view {
          padding: 0;
        }
        .checker-view-enter {
          animation: checkerFadeUp 0.35s ease-out;
        }
        .checker-view-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
        }
        .checker-back {
          flex-shrink: 0;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #fff;
          font-size: 0.9rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: background 0.2s, border-color 0.2s, color 0.2s;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .checker-back:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }
        .checker-back-arrow {
          font-size: 1.1em;
        }
        .checker-view-heading {
          min-width: 0;
        }
        .checker-view-title {
          font-size: clamp(1.05rem, 3vw, 1.2rem);
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .checker-view-sub {
          font-size: 0.85rem;
          color: #64748b;
          margin-top: 4px;
          margin-bottom: 0;
        }
        .checker-card {
          background: #f8fafc;
          border-radius: 18px;
          padding: clamp(16px, 4vw, 22px);
          border: 1px solid #e2e8f0;
          transition: box-shadow 0.2s;
        }
        .checker-card:focus-within {
          box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.2);
        }
        .checker-view .checker-card + .checker-card {
          margin-top: 16px;
        }
        .checker-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .checker-card-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .checker-chip {
          padding: 5px 11px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 600;
          background: rgba(15, 118, 110, 0.12);
          color: #0f766e;
          border: 1px solid rgba(15, 118, 110, 0.25);
        }
        .checker-penalty-list { overflow-x: auto; margin-top: 8px; }
        .checker-penalty-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .checker-penalty-table th,
        .checker-penalty-table td {
          padding: 10px 8px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        .checker-penalty-table th {
          font-weight: 600;
          color: #475569;
          background: rgba(0,0,0,0.03);
        }
        .checker-input-sm {
          min-width: 80px;
          padding: 8px 10px;
          font-size: 0.85rem;
        }
        .checker-penalty-count-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .checker-penalty-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #fff;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          color: #475569;
          transition: background 0.2s, border-color 0.2s;
        }
        .checker-penalty-btn:hover {
          background: #f1f5f9;
          border-color: #0f766e;
          color: #0f766e;
        }
        .checker-penalty-count {
          min-width: 28px;
          text-align: center;
          font-weight: 700;
          color: #0f172a;
        }
        .checker-btn-sm {
          padding: 6px 12px;
          font-size: 0.8rem;
          margin-right: 6px;
          margin-bottom: 4px;
        }
        .checker-audit-list {
          list-style: none;
          margin: 0;
          padding: 0;
          max-height: 220px;
          overflow-y: auto;
        }
        .checker-audit-item {
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.8rem;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 12px;
          align-items: center;
        }
        .checker-audit-action { font-weight: 600; color: #0f766e; }
        .checker-audit-actor { color: #475569; }
        .checker-audit-time { color: #64748b; }
        .checker-audit-meta { font-family: monospace; font-size: 0.75rem; color: #64748b; word-break: break-all; }
        .checker-form-stack > * + * { margin-top: 12px; }
        .checker-penalties-view { max-width: 100%; min-width: 0; }
        .checker-penalty-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 16px;
        }
        .checker-btn-add-counter {
          padding: 12px 20px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(145deg, #0369a1, #0284c7);
          color: #fff;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(3, 105, 161, 0.35);
          transition: transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1), box-shadow 0.25s ease;
          touch-action: manipulation;
        }
        .checker-btn-add-counter:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px rgba(3, 105, 161, 0.45);
        }
        .checker-btn-add-counter:active {
          transform: translateY(-1px);
        }
        .checker-penalty-layout { display: flex; gap: 6px; }
        .checker-layout-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          background: #fff;
          font-size: 0.85rem;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, color 0.2s;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .checker-layout-btn:hover { border-color: #0f766e; color: #0f766e; }
        .checker-layout-btn.active { border-color: #0f766e; background: rgba(15, 118, 110, 0.12); color: #0f766e; }
        .checker-penalty-form-card { margin-bottom: 16px; }
        .checker-penalty-empty { margin: 20px 0; text-align: center; color: #64748b; }
        .checker-penalty-grid {
          display: grid;
          gap: 8px;
          margin-bottom: 16px;
          min-width: 0;
          width: 100%;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 380px) {
          .checker-penalty-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 520px) {
          .checker-penalty-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (min-width: 680px) {
          .checker-penalty-grid { grid-template-columns: repeat(5, 1fr); }
        }
        @media (min-width: 840px) {
          .checker-penalty-grid { grid-template-columns: repeat(6, 1fr); }
        }
        @media (min-width: 1000px) {
          .checker-penalty-grid { grid-template-columns: repeat(7, 1fr); }
        }
        @media (min-width: 1160px) {
          .checker-penalty-grid { grid-template-columns: repeat(8, 1fr); }
        }
        @media (max-width: 379px) {
          .checker-penalty-grid { gap: 6px; }
        }
        @keyframes penaltyCardEnter {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes penaltyTapFlash {
          0% { transform: scale(1); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
          50% { transform: scale(1.04); box-shadow: 0 12px 32px rgba(0,0,0,0.25); }
          100% { transform: scale(1); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
        }
        .checker-penalty-counter-card {
          border-radius: 16px;
          padding: 10px;
          min-height: 0;
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: linear-gradient(165deg, var(--penalty-color, #6b21a8) 0%, rgba(0,0,0,0.2) 100%);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          transition: transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1), box-shadow 0.25s ease;
          animation: penaltyCardEnter 0.35s ease-out backwards;
        }
        .checker-penalty-counter-card:nth-child(1) { animation-delay: 0.02s; }
        .checker-penalty-counter-card:nth-child(2) { animation-delay: 0.05s; }
        .checker-penalty-counter-card:nth-child(3) { animation-delay: 0.08s; }
        .checker-penalty-counter-card:nth-child(4) { animation-delay: 0.11s; }
        .checker-penalty-counter-card:nth-child(5) { animation-delay: 0.14s; }
        .checker-penalty-counter-card:nth-child(n+6) { animation-delay: 0.17s; }
        .checker-penalty-counter-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.2); }
        .checker-penalty-counter-card:focus-within { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.18); }
        .checker-penalty-counter-card.penalty-tap-flash { animation: penaltyTapFlash 0.4s ease-out; }
        .checker-penalty-card-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
          flex-shrink: 0;
        }
        .checker-penalty-card-icon { font-size: 0.95rem; opacity: 0.95; }
        .checker-penalty-card-title {
          flex: 1;
          font-weight: 700;
          font-size: 0.8rem;
          color: #fff;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .checker-penalty-card-menu { position: relative; }
        .checker-penalty-dots {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: none;
          background: rgba(255,255,255,0.25);
          font-size: 1.25rem;
          line-height: 1;
          cursor: pointer;
          color: #fff;
          transition: background 0.2s;
        }
        .checker-penalty-dots:hover { background: rgba(255,255,255,0.4); }
        .checker-penalty-menu-backdrop { position: fixed; inset: 0; z-index: 10; }
        .checker-penalty-menu-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 6px;
          min-width: 110px;
          padding: 6px 0;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          border: 1px solid #e2e8f0;
          z-index: 11;
        }
        .checker-penalty-menu-dropdown button {
          display: block;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: none;
          font-size: 0.9rem;
          text-align: left;
          cursor: pointer;
          color: #334155;
          transition: background 0.2s;
        }
        .checker-penalty-menu-dropdown button:hover { background: #f1f5f9; }
        .checker-penalty-tap-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          flex: 1;
          min-height: 72px;
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 10px 8px;
          text-align: center;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          border-radius: 12px;
          transition: background 0.2s;
        }
        .checker-penalty-tap-area:hover { background: rgba(255,255,255,0.08); }
        .checker-penalty-tap-area:active { background: rgba(255,255,255,0.15); }
        .checker-penalty-tap-hint {
          margin: 6px 0 0;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.9);
          font-weight: 600;
        }
        .checker-penalty-circle-wrap { display: flex; justify-content: center; align-items: center; }
        .checker-penalty-circle {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 3px solid rgba(255,255,255,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(8px);
          transition: transform 0.2s;
        }
        .checker-penalty-tap-area:active .checker-penalty-circle { transform: scale(1.08); }
        .checker-penalty-circle-count {
          font-size: 1.4rem;
          font-weight: 800;
          color: #fff;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .checker-penalty-card-note {
          margin: 4px 0 0;
          font-size: 0.68rem;
          color: rgba(255,255,255,0.9);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .checker-penalty-history-card { margin-top: 8px; }
        .checker-history-list { max-height: 180px; }
        .checker-penalty-count-badge {
          margin-left: auto;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 8px;
          background: rgba(15, 118, 110, 0.2);
          color: #0f766e;
        }
        .checker-penalty-edit-inline {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
          padding: 12px;
          background: rgba(255,255,255,0.95);
          border-radius: 14px;
        }
        .checker-penalty-edit-inline .checker-input-sm { width: 100%; background: #fff; border-color: #e2e8f0; color: #0f172a; }
        .checker-penalty-edit-actions { display: flex; gap: 8px; margin-top: 4px; }
        .checker-penalty-audit-card { margin-top: 8px; }
        .checker-penalty-audit-actions { display: flex; gap: 8px; }
        .checker-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 8px;
          color: #334155;
        }
        .checker-field-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-bottom: 16px;
        }
        .checker-input {
          flex: 1;
          min-width: 120px;
          padding: 12px 16px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          font-size: 1rem;
          outline: none;
          color: #0f172a;
          background: #fff;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .checker-input:focus {
          border-color: #0d9488;
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
        }
        .checker-input-full {
          width: 100%;
          margin-bottom: 4px;
        }
        .checker-select {
          flex: 1;
          min-width: 100px;
          padding: 12px 16px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          font-size: 1rem;
          background: #fff;
          color: #0f172a;
        }
        .checker-btn-primary {
          padding: 12px 20px;
          border-radius: 14px;
          border: none;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(145deg, #0f766e, #0d9488);
          color: #fff;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(15, 118, 110, 0.35);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .checker-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15, 118, 110, 0.4);
        }
        .checker-btn-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .checker-btn-secondary {
          margin-top: 10px;
          padding: 12px 20px;
          border-radius: 14px;
          border: 2px solid #0d9488;
          background: #fff;
          color: #0d9488;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .checker-btn-secondary:hover {
          background: #0d9488;
          color: #fff;
        }
        .checker-actions {
          margin-top: 18px;
        }
        .checker-alert {
          margin-top: 14px;
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 0.88rem;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        .checker-alert.success {
          background: #ecfdf5;
          color: #166534;
          border: 1px solid #a7f3d0;
        }
        .checker-alert.error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }
        .checker-scan-view {
          padding: 0;
        }
        .checker-scan-camera-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 4/3;
          max-height: 70vh;
          background: #0f172a;
          border-radius: 20px;
          overflow: hidden;
        }
        .checker-scan-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .checker-scan-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          pointer-events: none;
          opacity: 0;
        }
        .checker-scan-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .checker-scan-frame {
          width: min(220px, 70vw);
          height: min(220px, 70vw);
          border: 3px solid rgba(255, 255, 255, 0.85);
          border-radius: 20px;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
        }
        .checker-scan-hint {
          margin: 16px 12px 0;
          color: #fff;
          font-size: clamp(0.85rem, 2.5vw, 0.95rem);
          text-align: center;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        }
        .checker-scan-warning {
          margin-top: 12px;
          padding: 14px 16px;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 12px;
          text-align: left;
        }
        .checker-scan-warning-msg {
          margin: 0 0 8px;
          font-size: 0.9rem;
          font-weight: 600;
          color: #92400e;
        }
        .checker-qr-label {
          margin: 0 0 4px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #78350f;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .checker-qr-url, .checker-qr-ref {
          margin: 0;
          font-size: 0.8rem;
          word-break: break-all;
          color: #1e293b;
        }
        .checker-qr-wrong-part {
          background: #fecaca;
          color: #b91c1c;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
        }
        .checker-fake-alert-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.6);
          animation: checkerFakeAlertFadeIn 0.2s ease-out;
        }
        @keyframes checkerFakeAlertFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .checker-fake-alert-popup {
          background: #fff;
          border-radius: 20px;
          padding: 24px;
          max-width: 400px;
          width: 100%;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
          border: 3px solid #dc2626;
          animation: checkerFakeAlertPop 0.25s ease-out;
        }
        @keyframes checkerFakeAlertPop {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .checker-fake-alert-icon {
          font-size: 3rem;
          text-align: center;
          margin-bottom: 8px;
        }
        .checker-fake-alert-title {
          margin: 0 0 4px;
          font-size: 1.35rem;
          font-weight: 800;
          color: #b91c1c;
          text-align: center;
        }
        .checker-fake-alert-subtitle {
          margin: 0 0 16px;
          font-size: 0.9rem;
          color: #64748b;
          text-align: center;
        }
        .checker-fake-alert-msg {
          margin: 0 0 12px;
          font-size: 0.9rem;
          font-weight: 600;
          color: #92400e;
        }
        .checker-fake-alert-popup .checker-qr-label {
          margin: 0 0 4px;
        }
        .checker-fake-alert-popup .checker-qr-url {
          margin: 0 0 20px;
        }
        .checker-fake-alert-btn {
          display: block;
          width: 100%;
          padding: 14px 20px;
          background: #dc2626;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }
        .checker-fake-alert-btn:hover {
          background: #b91c1c;
        }
        @media (max-width: 480px) {
          .checker-menu-buttons { gap: 12px; }
          .checker-menu-btn { min-height: 118px; }
          .checker-menu-today { font-size: 0.7rem; padding: 3px 8px; }
        }
        @media (max-width: 380px) {
          .checker-page { padding: 8px; }
          .checker-main { padding: 12px 10px; border-radius: 16px; max-width: 100%; }
          .checker-menu-btn { min-height: 100px; }
          .checker-penalty-toolbar { flex-direction: column; align-items: stretch; }
          .checker-penalty-layout { justify-content: center; }
        }
        @media (max-width: 480px) {
          .checker-header { gap: 8px; }
          .checker-main { max-width: calc(100vw - 16px); }
          .checker-view-header { flex-wrap: wrap; }
          .checker-back { padding: 8px 12px; font-size: 0.85rem; }
          .checker-view-title { font-size: 1rem; }
          .checker-btn-add-counter { padding: 10px 16px; font-size: 0.9rem; }
        }
      `}</style>
    </div>
  );
}
